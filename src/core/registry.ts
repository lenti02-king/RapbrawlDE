// Fighter content registry. Content modules register themselves on import;
// the simulation only looks definitions up by id (state stores ids, not objects).

import type { CardDef, FighterDef, MoveDef } from './defs';

const fighters = new Map<string, FighterDef>();

export function registerFighter(def: FighterDef): void {
  validateFighter(def);
  fighters.set(def.id, def);
}

export function getFighter(id: string): FighterDef {
  const f = fighters.get(id);
  if (!f) throw new Error(`Unknown fighter '${id}'`);
  return f;
}

/** The fighter whose presentation (animation set, emotes, signature music, taunts) a fighter id uses: its `base` for a
 *  look variant, else itself. Unknown ids map to themselves (cinematic extras, procedural looks). */
export function baseOf(id: string): string {
  return fighters.get(id)?.base ?? id;
}

export function listFighters(): FighterDef[] {
  return [...fighters.values()];
}

export function getMove(fighterId: string, key: string): MoveDef {
  const mv = getFighter(fighterId).moves[key];
  if (!mv) throw new Error(`Unknown move '${key}' for fighter '${fighterId}'`);
  return mv;
}

export function getCard(fighterId: string, cardId: string): CardDef {
  const c = getFighter(fighterId).cards.find((x) => x.id === cardId);
  if (!c) throw new Error(`Unknown card '${cardId}' for fighter '${fighterId}'`);
  return c;
}

export const LOADOUT_SLOTS = 3;
/** Slot layout: two special cards (S1, S2) + exactly one Signature card in the last slot (S3). */
export const SIGNATURE_SLOT = 2;
export const MAX_SIGNATURES = 1;

/** Returns null if the loadout is legal, otherwise a human-readable (German) reason. */
export function validateLoadout(fighterId: string, loadout: string[]): string | null {
  const def = getFighter(fighterId);
  // fighters without cards yet (D42 test fighters) play with an empty deck
  if (!def.cards.length) return loadout.length ? 'Dieser Kämpfer hat noch keine Karten' : null;
  if (loadout.length !== LOADOUT_SLOTS) return `Wähle 2 Specials und 1 Signature`;
  if (new Set(loadout).size !== loadout.length) return 'Karte doppelt';
  for (let i = 0; i < loadout.length; i++) {
    const c = def.cards.find((x) => x.id === loadout[i]);
    if (!c) return `Karte '${loadout[i]}' gehört nicht zu ${def.name}`;
    const isSig = c.category === 'signature';
    if (i === SIGNATURE_SLOT && !isSig) return 'Der dritte Slot ist für eine Signature-Karte';
    if (i !== SIGNATURE_SLOT && isSig) return 'Nur eine Signature pro Deck (Slot 3)';
  }
  return null;
}

function validateFighter(def: FighterDef): void {
  for (const [key, mv] of Object.entries(def.moves)) {
    if (mv.key !== key) throw new Error(`${def.id}: move key mismatch ${key} vs ${mv.key}`);
    if (mv.hits.length > 30) throw new Error(`${def.id}/${key}: too many hits`);
    for (const h of mv.hits) {
      if (h.start < 1 || h.end < h.start || h.end > mv.total)
        throw new Error(`${def.id}/${key}: hit window ${h.start}-${h.end} outside move (total ${mv.total})`);
      if (h.followup && !def.moves[h.followup]) throw new Error(`${def.id}/${key}: unknown followup ${h.followup}`);
      if (h.cinematic && !def.cinematics[h.cinematic])
        throw new Error(`${def.id}/${key}: unknown cinematic ${h.cinematic}`);
    }
    for (const c of mv.chains ?? []) if (!def.moves[c]) throw new Error(`${def.id}/${key}: unknown chain ${c}`);
    if (mv.counter && !def.moves[mv.counter.followup])
      throw new Error(`${def.id}/${key}: unknown counter followup`);
  }
  for (const n of Object.values(def.normals))
    if (n && !def.moves[n]) throw new Error(`${def.id}: normal '${n}' missing`);
  for (const c of def.cards) if (!def.moves[c.move]) throw new Error(`${def.id}: card ${c.id} -> missing move ${c.move}`);
  const reason = (() => {
    fighters.set(def.id, def);
    return validateLoadout(def.id, def.defaultLoadout);
  })();
  if (reason) throw new Error(`${def.id}: invalid default loadout: ${reason}`);
}
