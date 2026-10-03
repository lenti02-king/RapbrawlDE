// Registers all fighter content. Import this once before creating matches.
import { registerFighter } from '../core/registry';
import { BRICK } from './brick';
import { VOLT } from './volt';

registerFighter(VOLT);
registerFighter(BRICK);

export const ROSTER = [VOLT.id, BRICK.id];
