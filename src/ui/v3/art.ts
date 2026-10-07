// Design v3 (D46): light glows over the 3D renders' lamps per screen (x, y, radius, rgb in reference px), written by
// tools/ui3 from the Blender lamp positions projected through the shot camera. Empty = no flicker glows.
export const V3_LIGHTS: Record<string, [number, number, number, [number, number, number]][]> = {};
