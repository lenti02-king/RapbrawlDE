// Design v4 game modes (PO master: Frankfurt Hauptbahnhof): four mode tiles, ONLINE / OFFLINE, WEITER. The selected
// tile wears the master's blue neon frame (cut from the 1 VS 1 tile), the others its gold frame (cut from 2 VS 2);
// ONLINE / OFFLINE swap the master's lit and dark capsule (mirrored onto the other side) under their own labels.
import { toast } from '../menu/kit';
import { MODES_ART, MODES_DIR, MODES_LIGHTS, MODES_PLATE, MODES_TEXT } from './art/modes';
import { hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, sprite, type ScreenArt } from '../v2/stage';
import { goldButton, placed, tileButton, topHtml, xywh, type Wallet } from './kit4';

const A: ScreenArt = { dir: MODES_DIR, plate: MODES_PLATE, art: MODES_ART, lights: MODES_LIGHTS };

export type ModeTile = 'duel' | 'tag' | 'friends' | 'training';
const TILE_ID: Record<ModeTile, string> = { duel: 't_1v1', tag: 't_2v2', friends: 't_friends', training: 't_training' };

export interface ModesV4Model extends Wallet {
  tile: ModeTile;
  online: boolean;
}

/** The frame overlays for the current selection: the master's 1 VS 1 tile is painted selected, so it gets the gold
 *  frame when another tile is chosen. */
function framesHtml(sel: ModeTile): string {
  const out: string[] = [];
  for (const k of Object.keys(TILE_ID) as ModeTile[]) {
    const id = TILE_ID[k];
    const b = xywh(MODES_ART[id as keyof typeof MODES_ART]);
    if (k === sel) {
      // the blue ring is cut around the 1 VS 1 tile: scale its own box onto this tile's box
      const r = xywh(MODES_ART.ring_sel);
      const t = xywh(MODES_ART.t_1v1);
      const sx = (b[2] - b[0]) / (t[2] - t[0]);
      const sy = (b[3] - b[1]) / (t[3] - t[1]);
      out.push(placed(A, 'ring_sel', [b[0] + (r[0] - t[0]) * sx, b[1] + (r[1] - t[1]) * sy, b[0] + (r[2] - t[0]) * sx, b[1] + (r[3] - t[1]) * sy], 'v4-sel'));
    } else if (k === 'duel') {
      const r = xywh(MODES_ART.ring_gold);
      const t2 = xywh(MODES_ART.t_2v2);
      const sx = (b[2] - b[0]) / (t2[2] - t2[0]);
      const sy = (b[3] - b[1]) / (t2[3] - t2[1]);
      out.push(placed(A, 'ring_gold', [b[0] + (r[0] - t2[0]) * sx, b[1] + (r[1] - t2[1]) * sy, b[0] + (r[2] - t2[0]) * sx, b[1] + (r[3] - t2[1]) * sy]));
    }
  }
  return `<div class="v2-group v4-frames" style="--x:0;--y:0;--w:1672;--h:941">${out.join('')}</div>`;
}

/** ONLINE / OFFLINE: the lit capsule (the master's ONLINE) under the chosen side, the dark one under the other. */
function switchHtml(online: boolean): string {
  const on = xywh(MODES_ART.online);
  const off = xywh(MODES_ART.offline);
  const caps = online
    ? `${sprite(A, 'online')}${sprite(A, 'offline')}`
    : `${placed(A, 'offline', on, '', true)}${placed(A, 'online', off, 'v4-sel', true)}`;
  return `<div class="v2-group v4-switch" style="--x:0;--y:0;--w:1672;--h:941">${caps}${sprite(A, 'on_label')}${sprite(A, 'off_label')}
    <button class="v2-hit" data-act="online" aria-label="Online" style="--x:${on[0]};--y:${on[1]};--w:${on[2] - on[0]};--h:${on[3] - on[1]}"></button>
    <button class="v2-hit" data-act="offline" aria-label="Offline" style="--x:${off[0]};--y:${off[1]};--w:${off[2] - off[0]};--h:${off[3] - off[1]}"></button></div>`;
}

export function modesHtmlV4(m: ModesV4Model): string {
  const back = `${plateHtml(A)}${lightsHtml(A, 28)}`;
  const tiles = [
    tileButton(A, 't_1v1', 'duel', '1 gegen 1 – Duell', 0),
    tileButton(A, 't_2v2', 'tag', '2 gegen 2 – Tag-Team', 0.6, 'v4-soon'),
    tileButton(A, 't_friends', 'friends', 'Mit Freunden – private Lobby', 1.2),
    tileButton(A, 't_training', 'training', 'Training – Kombo-Training', 1.8),
  ].join('');
  const front = `${hazeHtml([200, 680, 1470, 900], '255 180 110', 0.3)}
    ${topHtml(A, MODES_TEXT, m)}${tiles}${framesHtml(m.tile)}${switchHtml(m.online)}
    ${goldButton(A, 'weiter', 'next', 'Weiter')}`;
  return screenHtml(back, front);
}

export type ModesV4Action = ModeTile | 'online' | 'offline' | 'next' | 'back' | 'shop' | 'news' | 'social';

export function mountModesV4(root: HTMLElement, m: ModesV4Model, onAction: (a: ModesV4Action, m: ModesV4Model) => void): () => void {
  const stop = mountV2(root, { hues: [36, 330, 205], living: A, haze: [0.6, 0.42, 0.35], crowdY: 0.25, rigid: [[640, 40, 390, 260]] });
  const redraw = () => {
    root.querySelector('.v4-frames')!.outerHTML = framesHtml(m.tile);
    root.querySelector('.v4-switch')!.outerHTML = switchHtml(m.online);
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || !root.contains(b)) return;
    const a = b.dataset.act as ModesV4Action;
    if (a === 'duel' || a === 'tag' || a === 'friends' || a === 'training') {
      if (a === 'tag') return toast(root, '2 GEGEN 2 (TAG-TEAM) KOMMT BALD');
      m.tile = a;
      redraw();
    } else if (a === 'online' || a === 'offline') {
      m.online = a === 'online';
      redraw();
    }
    onAction(a, m);
  });
  return stop;
}
