// Design v2 friends lobby (PO master ref/v2/lobby.webp). There is no game server: a room is either a code for a
// second tab on the same device (BroadcastChannel test) or a peer-to-peer invitation (WebRTC codes copied through a
// chat). The master's parts map onto that: RAUM-CODE = the room, FREUNDE EINLADEN = the P2P invitation, the friend
// list is empty (no accounts yet) and holds the join-by-code field, TEAM 1 / TEAM 2 slots show who is in, 2V2 is
// announced, the arena strip picks the arena, RAUM ERSTELLEN / BEITRETEN starts.
import { isV3 } from '../design';
import { de, esc } from '../menu/kit';
import { LOBBY_ART, LOBBY_DIR, LOBBY_LIGHTS, LOBBY_PLATE, LOBBY_TEXT } from './art/lobby';
import { topBarHtml } from './arena';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt, v3Art } from './stage';

const A2: ScreenArt = { dir: LOBBY_DIR, plate: LOBBY_PLATE, art: LOBBY_ART, lights: LOBBY_LIGHTS };
/** Design v3 (D46): the same layout with the stylized 3D renders (tools/ui3 -> assets/ui3/lobby/). */
const A3: ScreenArt = v3Art(A2, 'lobby');
let A = A2;
const T = LOBBY_TEXT;

export interface LobbyModel {
  name: string;
  level: number;
  xp: number;
  bust: string;
  fighter: string;
  code: string;
  lag: number;
  arenas: { id: string; name: string; img: string }[];
  arena: string;
  /** First arena shown in the strip (four at a time; the arrows page). */
  page: number;
  coins: number;
  gems: number;
  energy: string;
}

const box = (b: readonly number[], pad = 0) => `--x:${b[0] - pad};--y:${b[1] - pad};--w:${b[2] - b[0] + 2 * pad};--h:${b[3] - b[1] + 2 * pad}`;

export function lobbyHtml(m: LobbyModel): string {
  A = isV3() ? A3 : A2;
  const back = `${plateHtml(A)}${lightsHtml(A, 18)}`;
  const P = T.profile;
  const C = T.cur;
  const tap = (b: readonly number[], act: string, label: string, inner = '') =>
    `<button class="v2-hit" data-act="${act}" aria-label="${label}" style="${box(b)}">${inner}</button>`;
  const amt = (v: string, z: readonly number[], b: readonly number[]) => t(v, [z[0] - 6, z[1], z[2] + 6, z[3]], b[0], b[1], { cls: 'v2-num', fs: 27 });
  const top = `<span class="v2-win2 v2-av" style="${box(P.avatar)}">${m.bust ? `<img alt="" src="${m.bust}">` : ''}</span>
    ${t(m.name, [P.name[0], P.name[1], P.name[0] + 220, P.name[3]], 0, 0, { cls: 'v2-label', fs: 27 })}
    ${t(`Lv. ${m.level}`, zone(P.level), 0, 0, { cls: 'v2-label', fs: 25 })}
    <span class="v2-xp" style="${box(P.xp)};--p:${Math.max(0.04, Math.min(1, m.xp)).toFixed(3)}"><i></i></span>
    ${tap(C.t_coins, 'shop', 'Münzen', amt(de(m.coins), C.coins, C.t_coins))}
    ${tap(C.t_gems, 'shop', 'Diamanten', amt(de(m.gems), C.gems, C.t_gems))}
    ${tap(C.t_energy, 'shop', 'Energie', amt(m.energy, C.energy, C.t_energy))}
    ${tap(C.t_mail, 'news', 'Postfach')}${tap(C.t_gear, 'settings', 'Einstellungen')}`;

  const F = T.friends;
  const friends = `${t('FREUNDE (0)', [F.title[0], F.title[1], F.title[2] + 60, F.title[3]], 0, 0, { cls: 'v2-label', fs: 28 })}
    <div class="v2-flist" style="${box(F.list)}">
      <p>Noch keine Freunde gespeichert – Konten kommen mit dem Server.</p>
      <p><b>Raum beitreten:</b> Code vom Host eingeben.</p>
      <div class="v2-join"><input class="v2-code" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false"><button class="v2-pill" data-act="join">BEITRETEN</button></div>
      <p><b>Online über das Internet:</b></p>
      <div class="v2-join"><button class="v2-pill" data-act="rtc-host">EINLADUNG ERSTELLEN</button><button class="v2-pill" data-act="rtc-join">EINLADUNG ANNEHMEN</button></div>
      <div class="v2-status" role="status"></div>
    </div>`;

  const R = T.room;
  const room = `${t('RAUM-CODE', [R.label[0] - 20, R.label[1], R.label[2] + 20, R.label[3]], 0, 0, { cls: 'v2-small', fs: 22, align: 'center' })}
    ${t(m.code, zone(R.code), 0, 0, { cls: 'v2-label v2-roomcode', fs: 44, align: 'center' })}
    <button class="v2-hit" data-act="copy" aria-label="Code kopieren" style="${box(R.copy)}"></button>
    ${button(A, 'invite', 'rtc-host', 'Freunde einladen', (ox, oy) => t('FREUNDE EINLADEN', [T.invite.label[0] - 6, T.invite.label[1], T.invite.label[2] + 6, T.invite.label[3]], ox, oy, { cls: 'v2-label', fs: 24, align: 'center' }))}`;

  const TM = T.teams;
  const slot = (k: number, label: string, cls: string, inner = '') => {
    const b = TM[`s${k}` as 's0'];
    return `<button class="v2-hit v2-slot ${cls}" data-slot="${k}" aria-label="${esc(label)}" style="${box(b)}">${inner}</button>`;
  };
  const teams = `${t('TEAM 1', [TM.t1[0], TM.t1[1], TM.t1[2] + 10, TM.t1[3]], 0, 0, { cls: 'v2-marker', fs: 40 })}
    ${t('TEAM 2', [TM.t2[0], TM.t2[1], TM.t2[2] + 10, TM.t2[3]], 0, 0, { cls: 'v2-marker', fs: 40 })}
    ${slot(0, 'Du', 'me', m.bust ? `<img alt="" src="${m.bust}">` : '')}
    ${t(m.name, [TM.host_name[0] - 10, TM.host_name[1], TM.host_name[2] + 10, TM.host_name[3]], 0, 0, { cls: 'v2-label', fs: 24, align: 'center' })}
    ${t('HOST', zone(TM.host_tag), 0, 0, { cls: 'v2-label v2-gold', fs: 21, align: 'center' })}
    ${slot(1, '2 gegen 2 kommt bald', 'locked')}${t('2V2 BALD', [TM.i1[0] - 20, TM.i1[1], TM.i1[2] + 20, TM.i1[3]], 0, 0, { cls: 'v2-small v2-dim', fs: 20, align: 'center' })}
    ${slot(2, 'Gegner', 'opp')}${t('WARTET …', [TM.i2[0] - 24, TM.i2[1], TM.i2[2] + 24, TM.i2[3]], 0, 0, { cls: 'v2-label v2-oppstate', fs: 22, align: 'center' })}
    ${slot(3, '2 gegen 2 kommt bald', 'locked')}${t('2V2 BALD', [TM.i3[0] - 20, TM.i3[1], TM.i3[2] + 20, TM.i3[3]], 0, 0, { cls: 'v2-small v2-dim', fs: 20, align: 'center' })}`;

  const MO = T.mode;
  const mode = `${t('SPIELMODUS', [MO.title[0], MO.title[1], MO.title[2] + 40, MO.title[3]], 0, 0, { cls: 'v2-label', fs: 26 })}
    ${t('1V1', zone(MO.v1), 0, 0, { cls: 'v2-label v2-gold', fs: 28, align: 'center' })}${t('2V2', zone(MO.v2), 0, 0, { cls: 'v2-label v2-dim', fs: 28, align: 'center' })}
    <button class="v2-hit" data-act="mode2" aria-label="2 gegen 2" style="${box(MO.b2)}"></button>`;
  const S = T.settings;
  const set = `${t('MATCH-EINSTELLUNGEN', [S.title[0], S.title[1], S.title[2] + 60, S.title[3]], 0, 0, { cls: 'v2-label', fs: 24 })}
    ${t('RUNDEN', zone(S.r_l), 0, 0, { cls: 'v2-label', fs: 22 })}${t('2 SIEGE', [S.r_v[0] - 20, S.r_v[1], S.r_v[2] + 20, S.r_v[3]], 0, 0, { cls: 'v2-label', fs: 22, align: 'center' })}
    ${t('ZEIT', zone(S.t_l), 0, 0, { cls: 'v2-label', fs: 22 })}${t('99 s', [S.t_v[0] - 20, S.t_v[1], S.t_v[2] + 20, S.t_v[3]], 0, 0, { cls: 'v2-label', fs: 22, align: 'center' })}
    ${t('LAG-TEST', zone(S.d_l), 0, 0, { cls: 'v2-label', fs: 22 })}${t(`${m.lag} ms`, [S.d_v[0] - 10, S.d_v[1], S.d_v[2] + 10, S.d_v[3]], 0, 0, { cls: 'v2-label v2-lag', fs: 22, align: 'center' })}
    <button class="v2-hit" data-act="lag" aria-label="Lag-Test ändern" style="--x:1490;--y:572;--w:160;--h:46"></button>`;

  const AR = T.arenas;
  const n = m.arenas.length;
  const strip = [0, 1, 2, 3]
    .map((k) => {
      const a = m.arenas[(m.page + k) % n];
      const b = AR[`a${k}` as 'a0'];
      const fs = Math.min(22, Math.floor(236 / Math.max(8, a.name.length))); // Permanent Marker caps ~0.72 em wide, tile ~180 units
      return `<button class="v2-hit v2-astrip ${a.id === m.arena ? 'on' : ''}" data-arena="${a.id}" aria-label="${esc(a.name)}" style="${box(b)}"><img alt="" src="${a.img}"><span style="--afs:${fs}">${esc(a.name)}</span></button>`;
    })
    .join('');
  const arenas = `${t('ARENA', [AR.title[0], AR.title[1], AR.title[2] + 40, AR.title[3]], 0, 0, { cls: 'v2-label', fs: 24 })}${strip}
    <button class="v2-hit" data-act="arena-prev" aria-label="Vorherige Arenen" style="${box(AR.prev)}"></button>
    <button class="v2-hit" data-act="arena-next" aria-label="Weitere Arenen" style="${box(AR.next)}"></button>`;

  const st = T.start.label;
  const B = T.back.label;
  const front = `${hazeHtml([420, 560, 1300, 800], '200 170 255', 0.4)}
    ${topBarHtml(null, null).replace(/<button class="v2-btn "[^>]*data-back[\s\S]*?<\/button>/, '')}
    ${top}${friends}${room}${teams}${mode}${set}${arenas}
    ${button(A, 'back', 'back', 'Zurück', (ox, oy) => t('ZURÜCK', [B[0] - 4, B[1], B[2] + 30, B[3]], ox, oy, { cls: 'v2-label', fs: 30 })).replace('data-act="back"', 'data-act="back" data-back')}
    ${button(A, 'start', 'host', 'Raum erstellen', (ox, oy) => t('RAUM ERSTELLEN', zone([st[0] - 40, st[1], st[2] + 20, st[3]]), ox, oy, { cls: 'v2-brush', fs: 66, align: 'center' }), 'v2-main', `--mask:url(${src(A, 'start')})`)}`;
  return screenHtml(back, front);
}

export function lobbyStatus(root: HTMLElement, msg: string, err = false): void {
  const s = root.querySelector<HTMLElement>('.v2-status');
  if (!s) return;
  s.textContent = msg;
  s.classList.toggle('err', err);
}

export function lobbyOpponent(root: HTMLElement, label: string, bust = ''): void {
  const i = root.querySelector<HTMLElement>('.v2-oppstate > i');
  if (i) {
    i.textContent = label;
    i.dataset.t = label;
  }
  const s = root.querySelector<HTMLElement>('[data-slot="2"]');
  if (s && bust) s.innerHTML = `<img alt="" src="${bust}">`;
}

/** Sheet for the P2P invitation codes (content filled by the app). */
export function lobbySheet(root: HTMLElement, html: string): HTMLElement {
  root.querySelector('.v2-sheet')?.remove();
  const ov = document.createElement('div');
  ov.className = 'v2-sheet';
  ov.innerHTML = `<div class="v2-card gold v2-rtc"><div class="v2-rtc-body">${html}</div><button class="v2-pill" data-close>SCHLIESSEN</button></div>`;
  root.appendChild(ov);
  ov.querySelector('[data-close]')!.addEventListener('click', () => ov.remove());
  return ov;
}

export function mountLobby(root: HTMLElement): () => void {
  root.classList.add('v2-lobby');
  return mountV2(root, { embers: 22, hues: [210, 350, 42], living: A, haze: [0.45, 0.48, 0.8], crowdY: 0.55 });
}
