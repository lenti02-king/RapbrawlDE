// The fighters' home towns (PO): shown clearly under the name wherever a fighter is picked or presented (select,
// Kämpfer cards, customise, VS, the fight intro).
export const HOMETOWN: Record<string, string> = { jazeek: 'Aachen', bonez: 'Hamburg', manuellsen: 'Mülheim an der Ruhr', lacazette: 'Berlin' };

/** Home town of a fighter in capitals ('' for fighters without one). */
export const hometown = (id: string): string => (HOMETOWN[id] ?? '').toUpperCase();
