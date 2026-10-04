// Online play integration: networked match runner, lobby handshake and transports.
import type { MatchConfig } from '../core/state';
import { createMatch } from '../core/sim';
import { MatchRunner } from '../app/match';
import { NullSource, type InputSource } from '../input/sources';
import type { GameView } from '../render/view';
import { BroadcastTransport, RollbackSession, type LobbyMessage, type Transport, type WireMessage } from './rollback';

export const PROTOCOL_VERSION = 1;

/** Runs a match where only the local player's inputs come from this device. */
export class NetMatchRunner extends MatchRunner {
  readonly session: RollbackSession;
  lastRemoteMsgAt = performance.now();

  constructor(
    cfg: MatchConfig,
    view: GameView,
    readonly local: number,
    local_src: InputSource,
    readonly transport: Transport,
    inputDelay = 2,
  ) {
    const state = createMatch(cfg);
    super(state, view, local === 0 ? [local_src, new NullSource()] : [new NullSource(), local_src]);
    this.session = new RollbackSession(state, local, transport, { inputDelay });
    // wrap the session's handler to track connection liveness
    const deliver = transport.onMessage!;
    transport.onMessage = (m) => {
      this.lastRemoteMsgAt = performance.now();
      deliver(m);
    };
  }

  override frame(): void {
    const local = this.local;
    const bits = this.sources[local].poll(this.session.state, local);
    const r = this.session.tick(bits);
    this.state = this.session.state;
    const used = this.session.inputsUsed(Math.max(0, this.session.frame - 1));
    this.lastInputs = used;
    if (r.events.length) {
      this.view.handleEvents(this.state, r.events);
      for (const l of this.listeners) l.onEvents?.(this.state, r.events);
    }
  }

  /** Seconds since the last packet from the other player. */
  get silence(): number {
    return (performance.now() - this.lastRemoteMsgAt) / 1000;
  }
}

// ---------------------------------------------------------------- transports

/** Wraps a transport with artificial one-way latency (testing rollback on one machine). */
export class DelayedTransport implements Transport {
  onMessage: ((msg: WireMessage) => void) | null = null;
  constructor(
    private inner: Transport,
    public delayMs: number,
  ) {
    inner.onMessage = (m) => {
      if (this.delayMs <= 0) this.onMessage?.(m);
      else window.setTimeout(() => this.onMessage?.(m), this.delayMs);
    };
  }
  send(msg: WireMessage): void {
    this.inner.send(msg);
  }
  close(): void {
    this.inner.close?.();
  }
}

export function sameDeviceTransport(room: string, isHost: boolean, delayMs: number): Transport {
  const t = new BroadcastTransport(room, isHost ? 0 : 1);
  return delayMs > 0 ? new DelayedTransport(t, delayMs) : t;
}

/** Peer-to-peer WebRTC DataChannel (unreliable/unordered) with copy-paste signalling. */
export class RtcTransport implements Transport {
  onMessage: ((msg: WireMessage) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  readonly pc: RTCPeerConnection;
  private ch: RTCDataChannel | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc.ondatachannel = (e) => this.attach(e.channel);
  }

  private attach(ch: RTCDataChannel): void {
    this.ch = ch;
    ch.onopen = () => this.onOpen?.();
    ch.onclose = () => this.onClose?.();
    ch.onmessage = (e) => {
      try {
        this.onMessage?.(JSON.parse(e.data as string) as WireMessage);
      } catch {
        /* ignore malformed */
      }
    };
  }

  send(msg: WireMessage): void {
    if (this.ch?.readyState === 'open') this.ch.send(JSON.stringify(msg));
  }

  close(): void {
    this.ch?.close();
    this.pc.close();
  }

  private async gathered(): Promise<string> {
    await new Promise<void>((res) => {
      if (this.pc.iceGatheringState === 'complete') return res();
      const done = () => this.pc.iceGatheringState === 'complete' && res();
      this.pc.addEventListener('icegatheringstatechange', done);
      window.setTimeout(res, 5000);
    });
    return encodeCode(JSON.stringify(this.pc.localDescription));
  }

  /** Host: create the invite code. */
  async createInvite(): Promise<string> {
    this.attach(this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.gathered();
  }

  /** Guest: accept an invite, returns the reply code for the host. */
  async acceptInvite(code: string): Promise<string> {
    await this.pc.setRemoteDescription(JSON.parse(await decodeCode(code)) as RTCSessionDescriptionInit);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.gathered();
  }

  /** Host: finish with the guest's reply code. */
  async acceptReply(code: string): Promise<void> {
    await this.pc.setRemoteDescription(JSON.parse(await decodeCode(code)) as RTCSessionDescriptionInit);
  }
}

async function encodeCode(text: string): Promise<string> {
  let bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(cs).arrayBuffer());
  }
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'RB1' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodeCode(code: string): Promise<string> {
  const c = code.trim().replace(/^RB1/, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(c + '='.repeat((4 - (c.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(ds).text();
  }
  return new TextDecoder().decode(bytes);
}

// ----------------------------------------------------------------- lobby

export interface LobbyResult {
  cfg: MatchConfig;
  local: number;
}

/**
 * Host: waits for the guest's 'join', answers with the full match config.
 * Guest: sends 'join' (repeatedly until answered) and waits for 'hello'.
 */
export function runLobby(
  t: Transport,
  isHost: boolean,
  mine: { fighter: string; loadout: string[] },
  makeConfig: (guest: { fighter: string; loadout: string[] }) => MatchConfig,
): Promise<LobbyResult> {
  return new Promise((resolve, reject) => {
    let timer = 0;
    t.onMessage = (m: WireMessage) => {
      const msg = m as LobbyMessage;
      if (isHost && msg.t === 'join') {
        if (msg.v !== PROTOCOL_VERSION) return reject(new Error('Game versions differ. Update both devices.'));
        const cfg = makeConfig({ fighter: msg.fighter, loadout: msg.loadout });
        // repeat hello a few times (unreliable transports)
        let n = 0;
        const send = () => {
          t.send({ t: 'hello', v: PROTOCOL_VERSION, cfg });
          if (++n < 5) window.setTimeout(send, 60);
        };
        send();
        resolve({ cfg, local: 0 });
      } else if (!isHost && msg.t === 'hello') {
        window.clearInterval(timer);
        if (msg.v !== PROTOCOL_VERSION) return reject(new Error('Game versions differ. Update both devices.'));
        t.onMessage = null;
        resolve({ cfg: msg.cfg, local: 1 });
      }
    };
    if (!isHost) {
      const join = () => t.send({ t: 'join', v: PROTOCOL_VERSION, fighter: mine.fighter, loadout: mine.loadout });
      join();
      timer = window.setInterval(join, 250);
    }
  });
}
