// Design v3 camera per screen (S13): where the live fighter stands in the screen's layout (reference px of the 1672x941
// v2 layout, feet and figure height of the screen's fig-anchor) and how the arena is seen behind it.
export interface Shot {
  /** Feet of the (first) fighter anchor, reference px. */
  feet: [number, number];
  /** Anchor height in reference px = a 1.85 m fighter. */
  figH: number;
  /** Ring spot the fighter stands on (x, z in m; default the centre). */
  at?: [number, number];
  /** Every fighter spot on the ring (light pool + contact shadow), default [at]. */
  spots?: [number, number][];
  /** Camera pitch (deg, + looks down) and yaw (deg) - the solve keeps the feet on the anchor either way. */
  pitch?: number;
  yaw?: number;
  fov?: number;
}

export const SHOTS: Record<string, Shot> = {
  home: { feet: [832, 748], figH: 540, pitch: 0, fov: 40 },
};
