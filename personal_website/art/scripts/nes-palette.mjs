// The NES master palette (the common FCEUX-style 2C02 rendering), deduplicated.
// Every asset is snapped to these colors so all scenes share one palette.
const RAW = [
  '7C7C7C', '0000FC', '0000BC', '4428BC', '940084', 'A80020', 'A81000', '881400',
  '503000', '007800', '006800', '005800', '004058', '000000',
  'BCBCBC', '0078F8', '0058F8', '6844FC', 'D800CC', 'E40058', 'F83800', 'E45C10',
  'AC7C00', '00B800', '00A800', '00A844', '008888',
  'F8F8F8', '3CBCFC', '6888FC', '9878F8', 'F878F8', 'F85898', 'F87858', 'FCA044',
  'F8B800', 'B8F818', '58D854', '58F898', '00E8D8', '787878',
  'FCFCFC', 'A4E4FC', 'B8B8F8', 'D8B8F8', 'F8B8F8', 'F8A4C0', 'F0D0B0', 'FCE0A8',
  'F8D878', 'D8F878', 'B8F8B8', 'B8F8D8', '00FCFC', 'F8D8F8',
];

export const NES_PALETTE = [...new Set(RAW)].map((hex) => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
]);

// "Redmean" weighted RGB distance: cheap and much closer to perception than plain RGB.
function distance(r1, g1, b1, r2, g2, b2) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

const cache = new Map();

/** Index into NES_PALETTE of the closest color. */
export function nearestIndex(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NES_PALETTE.length; i++) {
    const [pr, pg, pb] = NES_PALETTE[i];
    const d = distance(r, g, b, pr, pg, pb);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  cache.set(key, best);
  return best;
}
