// The chimney smoke on the overworld. The model drew a still puff of smoke over two chimneys: the
// cottage's (About) and the workshop's (Projects). The site animates that smoke instead
// (src/components/Smoke.tsx, tuned in src/world/smoke.ts), so hires.mjs uses this file twice on
// the raw overworld picture:
//   cutSmoke       the puffs of the drawn smoke as a small sprite sheet, with its description
//   paintOutSmoke  the drawn smoke taken out of the picture, before the island is cut out of its sea
// Every number here is in the raw picture's own pixels (1376 x 768). It is not run on its own:
//   node art/scripts/hires.mjs overworld
import { Jimp } from 'jimp';

/**
 * The two chimneys, named after their locations.
 *   mouth  the middle of the top of the chimney's opening: where its smoke comes out
 *   smoke  [x0, y0, x1, y1] around the drawn smoke, down to the chimney's rim (x1 and y1 are not included)
 *   over   what is behind that smoke: 'grass' or 'sea'
 *   rim    the rows of the chimney's top edge that the smoke crosses, and the clean column on either side of the crossing
 */
export const CHIMNEYS = [
  { id: 'about', mouth: [704, 253], smoke: [688, 190, 746, 250], over: 'grass', rim: { rows: [250, 255], clean: [697, 712] } },
  { id: 'projects', mouth: [1007.5, 58], smoke: [994, 6, 1052, 56], over: 'sea', rim: { rows: [56, 64], clean: [1004, 1013] } },
];

/**
 * The cottage's smoke is three puffs, one above the other. Read from the chimney up they are one
 * puff as it ages: a wisp, a billow, a last thin puff. Each is [x0, y0, x1, y1] and becomes a frame
 * of the sheet, in that order. The wisp and the billow are one column of smoke in the picture:
 * each box fades out at its edge with its corners rounded (EDGE, ROUND), which turns the straight
 * cut between them into the round top of the wisp and the soft underside of the billow.
 */
const PUFFS = [
  [696, 236, 714, 252],
  [692, 210, 742, 236],
  [710, 190, 742, 210],
];

/** The scene grid the site draws the picture across (regions, the mascot and the smoke are measured in it). */
const UNITS = [320, 180];
/** Clean grass lies this far to the left of the cottage's smoke; it is copied over the smoke. */
const GRASS_FROM = 46;
/** A pixel this far from the grass color (in RGB) is not grass. */
const NOT_GRASS = 24;
/** Each puff fades to nothing over this many pixels at the edge of its box, so a cut never shows. */
const EDGE = 4;
/** The radius of a box's corners for that fade. */
const ROUND = 7;
/**
 * Clear pixels around each frame. The site shows one frame through a window and scales it smoothly,
 * down to a quarter on the title screen: with less room the next frame would bleed in at the edge.
 */
const PAD = 6;

const far = (data, i, [r, g, b]) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b);

/**
 * The sprite sheet: one row of frames of the same size, each puff with its middle (the center of
 * its weight) on the middle of its frame. A pixel's alpha is how far its color is from the grass
 * on the way to the smoke's own grey; solid pixels keep their own grey and soft ones take the
 * smoke's, so no green comes along and the puffs can rise over the sea as well.
 * Returns { sheet, meta }: the picture and what goes in smoke.json.
 */
export function cutSmoke(raw, grass) {
  const { data, width, height } = raw.bitmap;
  // Raw pixels per scene unit, each way: the picture is not exactly 16:9, so the two differ a little.
  const ux = width / UNITS[0], uy = height / UNITS[1];

  // The smoke's own grey: the average of the pixels that are plainly smoke.
  const grey = [0, 0, 0];
  let solid = 0;
  for (const [x0, y0, x1, y1] of PUFFS) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        if (far(data, i, grass) < 200) continue;
        grey[0] += data[i]; grey[1] += data[i + 1]; grey[2] += data[i + 2];
        solid++;
      }
    }
  }
  if (!solid) throw new Error('smoke.mjs: found no smoke over the cottage: have the PUFFS boxes moved?');
  for (let c = 0; c < 3; c++) grey[c] = Math.round(grey[c] / solid);
  const whole = Math.hypot(grey[0] - grass[0], grey[1] - grass[1], grey[2] - grass[2]);

  const puffs = PUFFS.map(([x0, y0, x1, y1]) => {
    const w = x1 - x0, h = y1 - y0;
    const image = new Jimp({ width: w, height: h, color: 0x00000000 });
    let weight = 0, cx = 0, cy = 0;
    const reach = { left: w, top: h, right: 0, bottom: 0 };
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const i = ((y0 + yy) * width + x0 + xx) * 4;
        const share = far(data, i, grass) / whole;
        // How deep the pixel is inside its box, the box's corners rounded off.
        const qx = Math.abs(xx + 0.5 - w / 2) - (w / 2 - ROUND), qy = Math.abs(yy + 0.5 - h / 2) - (h / 2 - ROUND);
        const deep = ROUND - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
        const edge = Math.min(1, Math.max(0, (deep + 0.5) / EDGE));
        const alpha = Math.round(255 * edge * Math.min(1, Math.max(0, (share - 0.08) / 0.82)));
        if (!alpha) continue;
        const o = (yy * w + xx) * 4;
        const own = share >= 0.9;
        for (let c = 0; c < 3; c++) image.bitmap.data[o + c] = own ? data[i + c] : grey[c];
        // A solid pixel may still carry a little of the grass: its green is held to its red and blue.
        if (own) image.bitmap.data[o + 1] = Math.min(data[i + 1], Math.round((data[i] + data[i + 2]) / 2) + 1);
        image.bitmap.data[o + 3] = alpha;
        weight += alpha; cx += alpha * (xx + 0.5); cy += alpha * (yy + 0.5);
        reach.left = Math.min(reach.left, xx); reach.right = Math.max(reach.right, xx + 1);
        reach.top = Math.min(reach.top, yy); reach.bottom = Math.max(reach.bottom, yy + 1);
      }
    }
    return { image, cx: cx / weight, cy: cy / weight, reach };
  });

  // One frame holds every puff with its middle on the frame's middle.
  const half = (pick) => Math.ceil(Math.max(...puffs.map(pick)) + PAD);
  const fw = 2 * half((p) => Math.max(p.cx - p.reach.left, p.reach.right - p.cx));
  const fh = 2 * half((p) => Math.max(p.cy - p.reach.top, p.reach.bottom - p.cy));
  const sheet = new Jimp({ width: fw * puffs.length, height: fh, color: 0x00000000 });
  puffs.forEach((p, n) => sheet.composite(p.image, n * fw + Math.round(fw / 2 - p.cx), Math.round(fh / 2 - p.cy)));

  const meta = {
    note: 'The smoke of the chimneys on the overworld. One row of frames: a puff as it ages, youngest first, each with its middle on the middle of its frame. Sizes and positions are in scene units (the picture is 320x180). Built by art/scripts/hires.mjs (smoke.mjs); how it moves is set in src/world/smoke.ts.',
    image: 'smoke.webp',
    over: 'overworld.webp',
    frame: [fw, fh],
    count: puffs.length,
    size: [fw / ux, fh / uy],
    chimneys: CHIMNEYS.map(({ id, mouth }) => ({ id, mouth: [mouth[0] / ux, mouth[1] / uy] })),
  };
  return { sheet, meta };
}

/**
 * Takes the drawn smoke out of the raw picture, in place. Over the grass it is covered with clean
 * grass from beside it; over the sea it becomes the sea's color, which the cut-out then clears.
 * Where the smoke crossed the top of its chimney, each row of the rim is drawn across the gap from
 * the clean pixels on either side.
 */
export function paintOutSmoke(raw, { grass, sea }) {
  const { data, width } = raw.bitmap;
  for (const { id, smoke: [x0, y0, x1, y1], over, rim } of CHIMNEYS) {
    if (over === 'sea') {
      // Nothing but sea and smoke is in the box.
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) data.set(sea, (y * width + x) * 4);
      }
    } else {
      // The smoke and the soft edge around it: every pixel within 2 of one that is not grass.
      const smoky = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1 && far(data, (y * width + x) * 4, grass) > NOT_GRASS;
      const cover = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          let near = false;
          for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = smoky(x + dx, y + dy);
          if (near) cover.push([x, y]);
        }
      }
      for (const [x, y] of cover) {
        const from = (y * width + x - GRASS_FROM) * 4;
        if (far(data, from, grass) > NOT_GRASS) throw new Error(`smoke.mjs: the grass ${GRASS_FROM} px left of the "${id}" smoke is not clean at ${x - GRASS_FROM},${y}`);
        data.copyWithin((y * width + x) * 4, from, from + 3);
      }
    }
    const [left, right] = rim.clean;
    for (let y = rim.rows[0]; y < rim.rows[1]; y++) {
      const a = (y * width + left) * 4, b = (y * width + right) * 4;
      for (let x = left + 1; x < right; x++) {
        const t = (x - left) / (right - left);
        for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = Math.round(data[a + c] + (data[b + c] - data[a + c]) * t);
      }
    }
  }
}

/** A picture to look at: the frames of a sheet, enlarged, on the grass and on the sea. */
export function smokePreview(sheet, { grass, sea }, times = 8) {
  const { width: w, height: h } = sheet.bitmap;
  const rgba = ([r, g, b]) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  const out = new Jimp({ width: w, height: h * 2, color: rgba(grass) });
  for (let y = h; y < h * 2; y++) for (let x = 0; x < w; x++) out.setPixelColor(rgba(sea), x, y);
  out.composite(sheet, 0, 0).composite(sheet, 0, h);
  return out.resize({ w: w * times, h: h * 2 * times, mode: 'nearestNeighbor' });
}
