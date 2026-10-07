// Design v4 friends lobby (PO master: Berlin, Pallasstraße): FREUNDE list with EINLADEN, DEINE LOBBY with the room
// code, the host row and three invite slots, 1 VS 1 / 2 VS 2, LOBBY ERSTELLEN. The same actions as the v2 lobby
// (data-act host / copy / rtc-host / rtc-join / join / mode2, data-slot), so the app's lobby logic is shared.
// ANFRAGEN opens the join panel (room code from a second tab, or a friend's invitation code); the list lives on the
// device until there is a server. Avatar windows keep the master's art until the PO's avatar artwork exists.
import { esc, toast } from '../menu/kit';
import { LOBBY_ART, LOBBY_DIR, LOBBY_LIGHTS, LOBBY_PLATE, LOBBY_TEXT } from './art/lobby';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, t, zone, type ScreenArt } from '../v2/stage';
import { goldButton, topHtml, xywh, type Wallet } from './kit4';

const A: ScreenArt = { dir: LOBBY_DIR, plate: LOBBY_PLATE, art: LOBBY_ART, lights: LOBBY_LIGHTS };
const T = LOBBY_TEXT;

export interface LobbyV4Model extends Wallet {
  name: string;
  code: string;
  friends: { name: string; code: string }[];
}

function rowsHtml(m: LobbyV4Model): string {
  return [0, 1, 2, 3]
    .map((i) => {
      const k = `f${i + 1}` as 'f1' | 'f2' | 'f3' | 'f4';
      const f = m.friends[i];
      const name = f ? t(f.name, zone(T[k].name), 0, 0, { cls: 'v4-title', fs: 27 }) : t('FREIER PLATZ', zone(T[k].name), 0, 0, { cls: 'v4-muted', fs: 24 });
      const status = f ? t(f.code, [T[k].status[0], T[k].status[1], T[k].status[2] + 60, T[k].status[3]], 0, 0, { cls: 'v4-status', fs: 21 }) : t('FREUND HINZUFÜGEN', [T[k].status[0], T[k].status[1], T[k].status[2] + 90, T[k].status[3]], 0, 0, { cls: 'v4-muted', fs: 19 });
      const inv = button(A, `inv${i + 1}`, f ? 'rtc-host' : 'add-friend', f ? `${f.name} einladen` : 'Freund hinzufügen', () => '', 'v4-btn').replace('<button ', `<button data-friend="${esc(f?.name ?? '')}" `);
      return `${name}${status}${inv}`;
    })
    .join('');
}

/** The join panel over the friend list (ANFRAGEN): a room code from the host, or a friend's invitation code. */
function joinHtml(): string {
  const b = xywh(LOBBY_ART.inv1);
  const w = b[2] - b[0];
  const h = b[3] - b[1];
  const blank = (x: number, y: number, act: string, label: string) =>
    `<button class="v2-btn v4-btn" data-act="${act}" aria-label="${esc(label)}" style="--x:${x};--y:${y};--w:${w};--h:${h}"><img class="v2-face" alt="" src="${A.dir}btn_blue.webp">${t(label, [8, 0, w - 8, h], 0, 0, { cls: 'v4-title', fs: 23, align: 'center' })}</button>`;
  return `<div class="v2-group v4-join" style="--x:0;--y:0;--w:1672;--h:941" hidden>
    <div class="v4-veil" style="--x:62;--y:330;--w:545;--h:428"></div>
    ${t('RAUM BEITRETEN', [96, 352, 560, 392], 0, 0, { cls: 'v4-title', fs: 30 })}
    ${t('Code vom Host (zweiter Tab oder Gerät im selben Netz):', [96, 394, 590, 420], 0, 0, { cls: 'v4-muted', fs: 18 })}
    <input class="v2-code v4-input" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false" style="--x:96;--y:434;--w:300;--h:58">
    ${blank(420, 432, 'join', 'BEITRETEN')}
    ${t('EINLADUNG VON EINEM FREUND', [96, 540, 590, 578], 0, 0, { cls: 'v4-title', fs: 26 })}
    ${t('Er schickt dir einen Einladungs-Code – hier einfügen:', [96, 580, 590, 606], 0, 0, { cls: 'v4-muted', fs: 18 })}
    ${blank(96, 620, 'rtc-join', 'ANNEHMEN')}
    ${blank(420, 620, 'join-close', 'SCHLIESSEN')}
  </div>`;
}

export function lobbyHtmlV4(m: LobbyV4Model): string {
  const back = `${plateHtml(A)}${lightsHtml(A, 28)}`;
  const tabs = `<button class="v2-hit" data-act="tab-friends" aria-label="Freunde" style="--x:72;--y:239;--w:189;--h:77"></button>
    <button class="v2-hit" data-act="tab-requests" aria-label="Anfragen" style="--x:265;--y:262;--w:184;--h:73"></button>
    <button class="v2-hit" data-act="tab-chat" aria-label="Chat" style="--x:453;--y:281;--w:150;--h:74"></button>`;
  const right = `${t(`RB-${m.code}`, zone(T.code.code), 0, 0, { cls: 'v4-title', fs: 34, align: 'center' })}
    ${button(A, 'copy', 'copy', 'Code kopieren', () => '', 'v4-btn')}
    ${t(m.name, zone(T.host.name), 0, 0, { cls: 'v4-title', fs: 26 })}
    ${button(A, 'slot1', 'rtc-host', 'Freund einladen', () => t('EINLADEN', zone(T.slot1.label), LOBBY_ART.slot1[0], LOBBY_ART.slot1[1], { cls: 'v4-title v4-slot1', fs: 28 }), 'v4-btn v4-slot')}
    ${button(A, 'slot2', 'slot', '2 gegen 2', () => '', 'v4-btn v4-soon').replace('<button ', '<button data-slot="1" ')}
    ${button(A, 'slot3', 'slot', '2 gegen 2', () => '', 'v4-btn v4-soon').replace('<button ', '<button data-slot="3" ')}
    ${button(A, 'b_1v1', 'mode1', '1 gegen 1', () => '', 'v4-btn')}${button(A, 'b_2v2', 'mode2', '2 gegen 2', () => '', 'v4-btn v4-soon')}`;
  const front = `${hazeHtml([520, 700, 1150, 900], '160 170 255', 0.3)}
    ${topHtml(A, T, m)}${tabs}${rowsHtml(m)}${right}${joinHtml()}
    ${goldButton(A, 'create', 'host', 'Lobby erstellen')}`;
  return screenHtml(back, front.replace('data-act="back"', 'data-act="back" data-back'));
}

/** Status of the room (the v2 lobby's status line): shown in the first invite slot and as a toast. */
export function lobbyStatusV4(root: HTMLElement, msg: string, err = false): void {
  toast(root, msg.toUpperCase());
  root.classList.toggle('v4-err', err);
}
export function lobbyOpponentV4(root: HTMLElement, label: string): void {
  const s = root.querySelector('.v4-slot1 > i');
  if (s) {
    s.textContent = label;
    s.setAttribute('data-t', label);
  }
}

export function mountLobbyV4(root: HTMLElement): () => void {
  const stop = mountV2(root, { hues: [210, 330, 42], living: A, haze: [0.42, 0.45, 0.75], crowdY: 0.25, rigid: [[660, 20, 350, 230]] });
  const join = root.querySelector<HTMLElement>('.v4-join')!;
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || !root.contains(b)) return;
    const a = b.dataset.act;
    if (a === 'tab-requests') join.hidden = false;
    else if (a === 'join-close' || a === 'tab-friends') join.hidden = true;
    else if (a === 'tab-chat') toast(root, 'CHAT KOMMT MIT DEM SERVER');
  });
  return stop;
}
