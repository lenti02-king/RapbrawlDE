// Leaderboard from the PO master (D38): the master plate with its texts removed, every value native. Offline for now:
// the player's rank points against a fixed CPU league (the rivals are game characters, clearly labelled as CPU).
import { LB_ART, LB_BOXES } from './boardArt';
import { de, keepLaidOut, layoutStage, pos, text, type Box } from './kit';

export interface BoardRow {
  name: string;
  motto: string;
  wins: number;
  rating: number;
  you?: boolean;
  avatar?: string; // player's bust (data URL); rivals keep the master's painted avatars
}
export interface BoardModel {
  rows: BoardRow[]; // 8 rows, sorted
  you: { name: string; motto: string; streak: number; wins: number; rank: number; avatar: string; tier: string };
  tiers: string[]; // 5 labels top to bottom
}

const B = LB_BOXES;
const SAFE: Box = [40, 0, 1960, 1090];

export function boardHtml(m: BoardModel): string {
  const p = LB_ART.plate;
  const rows = m.rows
    .map((r, i) => {
      const [y0, y1] = B.rows[i];
      const top3 = i < 3;
      const nameY = top3 ? y0 + 12 : y0 + 6;
      const youRow = r.you ? `<img class="mm-art" alt="" src="${LB_ART.you_row.src}" style="${pos(B.rowX[0], y0, B.rowX[1] - B.rowX[0], y1 - y0)}">` : '';
      const av = r.avatar ? `<span class="lb-av" style="${pos(B.avatarX[0] + 6, y0 + 4, B.avatarX[1] - B.avatarX[0] - 12, y1 - y0 - 8)}"><img alt="" src="${r.avatar}"></span>` : '';
      return `${youRow}${av}
        ${text(String(i + 1), [top3 ? 452 : 470, y0, top3 ? 540 : 530, y1], 0, 0, { cls: `lb-rank ${top3 ? 'top' : ''}`, fs: top3 ? 54 : 40, align: 'center' })}
        ${r.you ? text('DU', [420, y0 + 4, 470, y1 - 4], 0, 0, { cls: 'lb-you', fs: 26, align: 'center' }) : ''}
        ${text(r.name, [692, nameY, 1000, nameY + 34], 0, 0, { cls: 'lb-name', fs: 32 })}
        ${text(r.motto, [692, nameY + 32, 1010, nameY + 56], 0, 0, { cls: 'lb-motto', fs: 20 })}
        ${text(de(r.wins), [1020, y0, 1110, y1], 0, 0, { cls: 'lb-num', fs: 34, align: 'center' })}
        ${text(de(r.rating), [1190, y0, 1310, y1], 0, 0, { cls: 'lb-num', fs: 34 })}`;
    })
    .join('');
  const tierY = [432, 498, 562, 630, 696];
  const tiers = m.tiers.map((t, i) => text(t, [228, tierY[i], 380, tierY[i] + 40], 0, 0, { cls: 'lb-tier', fs: 28 })).join('');
  const st = (y: number, l: string, v: string) =>
    `${text(l, [1508, y, 1720, y + 36], 0, 0, { cls: 'lb-slab', fs: 26 })}${text(v, [1764, y, 1910, y + 36], 0, 0, { cls: 'lb-sval', fs: 28 })}`;
  return `<div class="cs-blur" style="background-image:url(${p.src})"></div>
    <div class="cs-stage">
      <img class="cs-bg" alt="" draggable="false" src="${LB_ART.backdrop.src}" style="${pos(LB_ART.backdrop.x, LB_ART.backdrop.y, LB_ART.backdrop.w, LB_ART.backdrop.h)}">
      <img class="cs-bg" alt="" draggable="false" src="${p.src}" style="${pos(0, 0, p.w, p.h)}">
      ${text('BESTENLISTE', [B.title[0] + 40, B.title[1], B.title[2], B.title[3]], 0, 0, { cls: 'as-title', fs: 96, align: 'center' })}
      ${text('LIGEN', [150, 350, 330, 390], 0, 0, { cls: 'lb-head', fs: 30, align: 'center' })}
      ${tiers}
      ${text('#', [444, 408, 500, 440], 0, 0, { cls: 'lb-head', fs: 24, align: 'center' })}
      ${text('SPIELER', [690, 408, 900, 440], 0, 0, { cls: 'lb-head', fs: 24 })}
      ${text('SIEGE', [1020, 408, 1110, 440], 0, 0, { cls: 'lb-head', fs: 24, align: 'center' })}
      ${text('PUNKTE', [1180, 408, 1310, 440], 0, 0, { cls: 'lb-head', fs: 24 })}
      ${rows}
      ${text('DEINE WERTE', [1504, 396, 1760, 436], 0, 0, { cls: 'lb-head', fs: 30 })}
      <span class="lb-av big" style="${pos(1512, 452, 132, 132)}">${m.you.avatar ? `<img alt="" src="${m.you.avatar}">` : ''}</span>
      ${text(m.you.name, [1676, 466, 1910, 506], 0, 0, { cls: 'lb-name', fs: 36 })}
      ${text(m.you.motto, [1676, 506, 1910, 534], 0, 0, { cls: 'lb-motto blue', fs: 22 })}
      ${st(598, 'SIEGSERIE', `${m.you.streak} SIEGE`)}${st(648, 'SIEGE GESAMT', de(m.you.wins))}${st(698, 'PLATZ', `#${m.you.rank}`)}${st(760, 'SAISON-KISTE', '')}
      <button class="mm-btn lb-btn" data-back aria-label="Zurück" style="${pos(LB_ART.btn_blue.x, LB_ART.btn_blue.y, LB_ART.btn_blue.w, LB_ART.btn_blue.h)}">
        <img class="mm-art" alt="" src="${LB_ART.btn_blue.src}" style="${pos(0, 0, LB_ART.btn_blue.w, LB_ART.btn_blue.h)}">
        ${text('ZURÜCK', [LB_ART.btn_blue.x + 70, LB_ART.btn_blue.y + 18, LB_ART.btn_blue.x + LB_ART.btn_blue.w - 30, LB_ART.btn_blue.y + LB_ART.btn_blue.h - 18], LB_ART.btn_blue.x, LB_ART.btn_blue.y, { cls: 'as-back', fs: 44, align: 'center' })}
      </button>
      <button class="mm-btn lb-btn" data-season aria-label="Saison-Belohnungen" style="${pos(LB_ART.btn_gold.x, LB_ART.btn_gold.y, LB_ART.btn_gold.w, LB_ART.btn_gold.h)}">
        <img class="mm-art" alt="" src="${LB_ART.btn_gold.src}" style="${pos(0, 0, LB_ART.btn_gold.w, LB_ART.btn_gold.h)}">
        ${text('SAISON-BELOHNUNGEN', [LB_ART.btn_gold.x + 110, LB_ART.btn_gold.y + 26, LB_ART.btn_gold.x + LB_ART.btn_gold.w - 30, LB_ART.btn_gold.y + LB_ART.btn_gold.h - 26], LB_ART.btn_gold.x, LB_ART.btn_gold.y, { cls: 'cs-ready', fs: 40, align: 'center' })}
      </button>
    </div>
    <div class="mm-toast" hidden></div>`;
}

export function mountBoard(root: HTMLElement): () => void {
  root.classList.add('mm', 'board');
  const stage = root.querySelector<HTMLElement>('.cs-stage')!;
  return keepLaidOut(root, () => layoutStage(root, stage, SAFE, LB_ART.backdrop));
}

