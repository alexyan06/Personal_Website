// Reads the per-frame samples from qa/lib/inpage.mjs: did anything a camera move could be
// applied to (stage, scene roots, the layers between, scene images) scale, move or fade?
import { fmt } from './util.mjs';

function normTransform(t) {
  if (!t || t === 'none') return 'none';
  const m = /^(matrix|matrix3d)\(([^)]+)\)$/.exec(t);
  if (!m) return t;
  const values = m[2].split(',').map((v) => Math.round(Number(v) * 1000) / 1000);
  const text = values.join(', ');
  if (text === '1, 0, 0, 1, 0, 0' || text === '1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1') return 'none';
  return `${m[1]}(${text})`;
}

const neutral = (v) => !v || v === 'none' || v === '0px' || v === '0px 0px' || v === '1' || v === '1 1' || v === '0deg';

export function analyzeSamples(sampling) {
  const out = { count: 0, durationMs: 0, everRunning: false, runningMs: 0, moved: [], animated: [], maxScale: 1 };
  const samples = sampling?.samples ?? [];
  if (!samples.length) return out;
  const meta = sampling.meta ?? {};
  out.count = samples.length;
  out.durationMs = Math.round(samples[samples.length - 1].t - samples[0].t);

  const running = samples.filter((s) => s.transition === 'running');
  if (running.length) {
    out.everRunning = true;
    const lastIndex = samples.lastIndexOf(running[running.length - 1]);
    const end = samples[lastIndex + 1] ?? samples[lastIndex];
    out.runningMs = Math.round(end.t - running[0].t);
  }

  const per = new Map();
  for (const sample of samples) {
    for (const [id, transform, translate, scale, rotate, opacity, x, y, w, h] of sample.els) {
      if (w === 0 && h === 0) continue; // not rendered in this frame
      let rec = per.get(id);
      if (!rec) {
        rec = { transforms: [], boxChanges: 0, last: null, min: [x, y, w, h], max: [x, y, w, h], opacities: [] };
        per.set(id, rec);
      }
      const key = [normTransform(transform), neutral(translate) ? '' : `translate ${translate}`, neutral(scale) ? '' : `scale ${scale}`, neutral(rotate) ? '' : `rotate ${rotate}`]
        .filter(Boolean)
        .join(' ');
      if (rec.transforms[rec.transforms.length - 1] !== key) rec.transforms.push(key);
      const box = [x, y, w, h];
      if (rec.last && box.some((v, i) => Math.abs(v - rec.last[i]) > 0.5)) rec.boxChanges++;
      if (!rec.last || box.some((v, i) => Math.abs(v - rec.last[i]) > 0.5)) rec.last = box;
      box.forEach((v, i) => {
        rec.min[i] = Math.min(rec.min[i], v);
        rec.max[i] = Math.max(rec.max[i], v);
      });
      const o = Math.round(Number(opacity) * 100) / 100;
      if (rec.opacities[rec.opacities.length - 1] !== o) rec.opacities.push(o);
    }
  }

  for (const [id, rec] of per) {
    const name = meta[id] ?? `element ${id}`;
    const range = Math.max(...rec.max.map((v, i) => v - rec.min[i]));
    if (rec.min[2] > 0) out.maxScale = Math.max(out.maxScale, rec.max[2] / rec.min[2]);
    if (rec.transforms.length > 1) {
      const more = rec.transforms.length > 2 ? ` and ${rec.transforms.length - 2} more value(s)` : '';
      out.moved.push(`${name}: transform went from ${rec.transforms[0]} to ${rec.transforms[1]}${more}`);
    } else if (range > 0.5) {
      out.moved.push(`${name}: its box moved or resized by up to ${fmt(range)} px`);
    }
    if (rec.transforms.length > 2 || rec.boxChanges > 1) {
      out.animated.push(`${name} animated (${Math.max(rec.transforms.length, rec.boxChanges + 1)} different positions or transforms)`);
    } else {
      const between = [...new Set(rec.opacities.filter((o) => o > 0.02 && o < 0.98))];
      if (between.length >= 2) out.animated.push(`${name} faded (opacity ${rec.opacities.slice(0, 5).join(', ')})`);
    }
  }
  return out;
}
