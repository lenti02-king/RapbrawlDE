// Design switch (D42): v1 = the first master set (D38/D41), v2 = the PO's second master set (painted), v3 (D46, the
// default) = the v2 layouts with stylized 3D art rendered in Blender (tools/ui3 -> assets/ui3, skin src/ui/v3). All stay in the code; the
// choice is remembered per device. `?ui=v1|v2|v3` sets it from a link (and is remembered too), the settings screen
// has a toggle. v3 runs on the v2 screen modules (same layout), so isV2() is true for both.
export type Design = 'v1' | 'v2' | 'v3';

const KEY = 'rapbrawl.design';
let current: Design | null = null;

function read(): Design {
  const q = new URLSearchParams(location.search).get('ui');
  if (q === 'v1' || q === 'v2' || q === 'v3') {
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* storage unavailable */
    }
    return q;
  }
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'v1' || v === 'v2' || v === 'v3') return v;
  } catch {
    /* storage unavailable */
  }
  return 'v3';
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

/** The v2 screen modules run (v2 painted or v3 3D). */
export const isV2 = (): boolean => design() !== 'v1';
/** Design v3: 3D arena plates + cartoon UI kit on the v2 screens. */
export const isV3 = (): boolean => design() === 'v3';
