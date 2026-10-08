// Registers all fighter content. Import this once before creating matches.
import { registerFighter } from '../core/registry';
import { BONEZ } from './bonez';
import { BRICK } from './brick';
import { JAZEEK } from './jazeek';
import { LACAZETTE } from './lacazette';
import { MANUELLSEN } from './manuellsen';
import { VOLT } from './volt';

registerFighter(JAZEEK);
registerFighter(BONEZ);
// S16: the PO's anime / cel-shaded Jazeek (modelle-4) as a fighter of its own: same moves, cards and specials, own model
export const JAZEEK_TOON = { ...JAZEEK, id: 'jazeektoon', name: 'JAZEEK CARTOON', base: JAZEEK.id };
registerFighter(JAZEEK_TOON);
// D42: the PO's cartoon-style test fighters (2D cutouts, movement + normals, no cards yet)
registerFighter(MANUELLSEN);
registerFighter(LACAZETTE);
// Legacy prototype fighters: kept for regression tests and dev, hidden from the roster.
registerFighter({ ...VOLT, hidden: true });
registerFighter({ ...BRICK, hidden: true });

/** Fighters selectable in the game UI. */
export const ROSTER = [JAZEEK.id, BONEZ.id, MANUELLSEN.id, LACAZETTE.id, JAZEEK_TOON.id];
