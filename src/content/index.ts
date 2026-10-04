// Registers all fighter content. Import this once before creating matches.
import { registerFighter } from '../core/registry';
import { BONEZ } from './bonez';
import { BRICK } from './brick';
import { JAZEEK } from './jazeek';
import { VOLT } from './volt';

registerFighter(JAZEEK);
registerFighter(BONEZ);
// Legacy prototype fighters: kept for regression tests and dev, hidden from the roster.
registerFighter({ ...VOLT, hidden: true });
registerFighter({ ...BRICK, hidden: true });

/** Fighters selectable in the game UI. */
export const ROSTER = [JAZEEK.id, BONEZ.id];
