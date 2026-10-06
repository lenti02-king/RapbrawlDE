// Design switch (D42): v1 = the first master set (D38/D41), v2 = the PO's second master set. Both stay in the code;
// the choice is remembered per device. `?ui=v1|v2` sets it from a link (and is remembered too), the settings screen
// has a toggle. Screens without a v2 master keep their v1 layout in both designs.
export type Design = 'v1' | 'v2';

const KEY = 'rapbrawl.design';
let current: Design | null = null;

function read(): Design {
  const q = new URLSearchParams(location.search).get('ui');
  if (q === 'v1' || q === 'v2') {
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* storage unavailable */
    }
    return q;
  }
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'v1' || v === 'v2') return v;
  } catch {
    /* storage unavailable */
  }
  return 'v2';
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
