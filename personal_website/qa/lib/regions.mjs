// Expected hotspots, read from art/approved/*.regions.json.
//   overworld: its top-level region ids only.
//   a room:    every region id except ids starting with "spare", plus `<id>-<index>` for each entry of an `items` array.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_DIR, ROOMS } from './config.mjs';

const isBox = (b) =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number' && Number.isFinite(n)) && b[2] > 0 && b[3] > 0;

export async function loadSceneRegions(dir, scene) {
  const file = path.join(dir, scene === 'world' ? 'overworld.regions.json' : `${scene}.regions.json`);
  const shown = path.relative(PROJECT_DIR, file) || file;
  const out = { scene, file: shown, usable: false, problems: [], hotspots: [] };

  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    out.problems.push(error.code === 'ENOENT' ? `${shown} does not exist yet` : `${shown} could not be read: ${error.message}`);
    return out;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    out.problems.push(`${shown} is not valid JSON: ${error.message}`);
    return out;
  }
  if (!json || typeof json.regions !== 'object' || json.regions === null || Array.isArray(json.regions)) {
    out.problems.push(`${shown} has no "regions" object`);
    return out;
  }

  out.usable = true;
  for (const [id, region] of Object.entries(json.regions)) {
    if (id.startsWith('spare')) continue;
    const box = isBox(region?.box) ? region.box : null;
    if (!box) out.problems.push(`${shown}: region "${id}" has no valid box [x, y, w, h]`);
    const items = scene !== 'world' && Array.isArray(region?.items) ? region.items : [];
    out.hotspots.push({ id, box, kind: 'region', shelf: items.length > 0 });
    items.forEach((entry, index) => {
      const itemBox = isBox(entry) ? entry : isBox(entry?.box) ? entry.box : null;
      if (!itemBox) out.problems.push(`${shown}: item ${index} of "${id}" has no valid box [x, y, w, h]`);
      out.hotspots.push({ id: `${id}-${index}`, box: itemBox, kind: 'item', parent: id });
    });
  }
  return out;
}

/** { world, about, experience, ... } */
export async function loadAllRegions(dir) {
  const scenes = ['world', ...ROOMS];
  const loaded = await Promise.all(scenes.map((scene) => loadSceneRegions(dir, scene)));
  return Object.fromEntries(scenes.map((scene, i) => [scene, loaded[i]]));
}
