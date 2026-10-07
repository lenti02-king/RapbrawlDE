// Design v2 FREUNDE (S12, PO: "bei Freunde kommt die Kämpferauswahl anstatt ein Fenster, wo man Freunde adden und
// suchen kann"). The ring backdrop and panel look of the other v2 ring screens. There is no game server yet, so the
// list is kept on this device: every player has a fixed friend code (RB-XXXX-XXXX) to pass on; a friend is added by
// name + code; the search filters the list (a worldwide player search needs the server and says so). HERAUSFORDERN
// opens the online lobby (room code / invitation code) with the friend's name noted.
import { esc } from '../menu/kit';
import { LINE } from '../lines';
import { topBarHtml, type TopBar } from './arena';
import { goldBtn, ringFigure } from './ring';
import { hazeHtml, screenHtml } from './stage';

export interface Friend {
  name: string;
  code: string;
  added: number;
  /** Last time the player opened a lobby for this friend (ms). */
  last?: number;
}

type Rect = [number, number, number, number];
const at = (r: Rect) => `--x:${r[0]};--y:${r[1]};--w:${r[2]};--h:${r[3]}`;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A new random friend code (crypto random, no 0/O/1/I). */
export function newFriendCode(): string {
  const n = new Uint8Array(8);
  crypto.getRandomValues(n);
  const s = Array.from(n, (b) => CODE_ABC[b % CODE_ABC.length]).join('');
  return `RB-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Normalise what a player typed into the RB-XXXX-XXXX form, or null if it cannot be a code. */
export function parseFriendCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^RB/, '');
  if (s.length !== 8 || [...s].some((c) => !CODE_ABC.includes(c))) return null;
  return `RB-${s.slice(0, 4)}-${s.slice(4)}`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function ago(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 86400000);
  return d <= 0 ? 'HEUTE' : d === 1 ? 'GESTERN' : `VOR ${d} TAGEN`;
}

function friendRow(f: Friend): string {
  return `<div class="fr-row" data-code="${esc(f.code)}">
    <span class="fr-av">${esc(initials(f.name))}</span>
    <span class="fr-who"><b>${esc(f.name)}</b><span>${esc(f.code)} · ${f.last ? `GESPIELT ${ago(f.last)}` : `HINZUGEFÜGT ${ago(f.added)}`}</span></span>
    <button class="fr-go" data-challenge="${esc(f.code)}" aria-label="${esc(f.name)} herausfordern">${LINE.swords}<span>HERAUSFORDERN</span></button>
    <button class="fr-x" data-remove="${esc(f.code)}" aria-label="${esc(f.name)} entfernen">✕</button>
  </div>`;
}

export function friendsListHtml(list: Friend[], query = ''): string {
  const q = query.trim().toUpperCase();
  const hit = q ? list.filter((f) => f.name.toUpperCase().includes(q) || f.code.replace(/-/g, '').includes(q.replace(/[^A-Z0-9]/g, ''))) : list;
  if (!list.length) return `<div class="fr-empty">Noch keine Freunde.<br>Schick deinen Code oder füge links einen Freund hinzu.</div>`;
  if (!hit.length)
    return `<div class="fr-empty">Kein Freund mit „${esc(query)}“ in deiner Liste.${parseFriendCode(query) ? '<br><button class="rg-chip" data-addcode>ALS FREUND HINZUFÜGEN</button>' : ''}<br><small>Spielersuche weltweit kommt mit dem Online-Server.</small></div>`;
  return hit
    .slice()
    .sort((a, b) => (b.last ?? b.added) - (a.last ?? a.added))
    .map(friendRow)
    .join('');
}

export function friendsHtml(myCode: string, myName: string, list: Friend[], top: TopBar): string {
  const card = (r: Rect, inner: string, cls = '') => `<div class="rg-card fr-card ${cls}" style="${at(r)}">${inner}</div>`;
  const head = (s: string, icon: string) => `<div class="rg-head"><span class="rg-hicon">${icon}</span><span>${esc(s)}</span></div>`;
  const mine = card(
    [40, 112, 556, 236],
    `${head('DEIN FREUNDES-CODE', LINE.crown)}
     <div class="fr-mycode">${esc(myCode)}</div>
     <div class="fr-line"><span class="rg-txt">Gib ihn deinen Freunden – als <b>${esc(myName)}</b>.</span><button class="rg-chip" data-copy>KOPIEREN</button></div>`,
    'gold',
  );
  const add = card(
    [40, 364, 556, 330],
    `${head('FREUND HINZUFÜGEN', LINE.fighter)}
     <label class="fr-field"><span>NAME</span><input class="fr-in" data-in="name" maxlength="16" placeholder="z. B. Kalle" autocomplete="off" spellcheck="false"></label>
     <label class="fr-field"><span>CODE</span><input class="fr-in code" data-in="code" maxlength="12" placeholder="RB-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
     <div class="fr-line"><span class="fr-msg" data-msg></span><button class="rg-chip on" data-add>HINZUFÜGEN</button></div>`,
  );
  const play = card(
    [40, 710, 556, 184],
    `${head('ONLINE SPIELEN', LINE.swords)}
     <div class="rg-txt fr-note">Raum öffnen, Code an den Freund – oder ihn rechts direkt herausfordern.</div>`,
  );
  const friends = card(
    [1076, 112, 556, 782],
    `${head(`FREUNDE (${list.length})`, LINE.trophy)}
     <label class="fr-search"><span aria-hidden="true">⌕</span><input class="fr-in" data-in="search" maxlength="20" placeholder="Name oder Code suchen" autocomplete="off" spellcheck="false"></label>
     <div class="fr-list" data-list>${friendsListHtml(list)}</div>`,
  );
  const front = `${hazeHtml([520, 760, 1150, 930], '170 150 255', 0.5)}
    ${topBarHtml('FREUNDE', top)}
    ${mine}${add}${play}${friends}
    ${goldBtn('room', 'RAUM ÖFFNEN', [176, 808, 290, 74], 40, false)}`;
  return screenHtml(ringFigure(560), front);
}
