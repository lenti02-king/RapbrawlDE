// Design switch (D42): v1 = the first master set (D38/D41), v2 = the PO's second master set (painted), v4 (D47, the
// default) = the PO's street master set (Frankfurt / Berlin, src/ui/v4). The Blender design v3 (D46) was discarded
// by the PO (git history). All stay in the code; the choice is remembered per device (a stored 'v3' reads as the
// default). `?ui=v1|v2|v4` sets it from a link (and is remembered too), the settings screen has a toggle. v4 shares
// the flow and the screens without a v4 master with v2, so isV2() is true for both.
export type Design = 'v1' | 'v2' | 'v4';

const KEY = 'rapbrawl.design';
let current: Design | null = null;

function read(): Design {
  const q = new URLSearchParams(location.search).get('ui');
  if (q === 'v1' || q === 'v2' || q === 'v4') {
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* storage unavailable */
    }
    return q;
  }
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'v1' || v === 'v2' || v === 'v4') return v;
  } catch {
    /* storage unavailable */
  }
  return 'v4';
}

export function design(): Design {
  if (!current) {
    current = read();
    document.documentElement.dataset.design = current;
  }
  return current;
}

export function setDesign(d: Design): void {
  current = d;
  document.documentElement.dataset.design = d;
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* storage unavailable */
  }
}

/** The v2 flow runs (v2 painted or v4 street). */
export const isV2 = (): boolean => design() !== 'v1';
/** Design v4: the PO's street masters (home, modes, select, customize, lobby) and their pieces elsewhere. */
export const isV4 = (): boolean => design() === 'v4';
