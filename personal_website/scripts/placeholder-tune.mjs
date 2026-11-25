#!/usr/bin/env node
// Makes music/published/placeholder-tune.mp3: a short chiptune loop written here, so the live
// site's player has one song that is free to use until real ones are added.
// Square-wave lead over a triangle bass, plain broken chords. Needs ffmpeg for the MP3 step.
//
//   node scripts/placeholder-tune.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RATE = 44100;
const BPM = 132;
const STEP = 60 / BPM / 2; // one eighth note, seconds

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (note) => 440 * 2 ** ((SEMITONES[note[0]] + (Number(note.slice(1)) - 4) * 12 - 9) / 12);

// Eight bars: a broken chord going up and back per bar, the second half an octave figure higher.
const CHORDS = [['C', 'E', 'G'], ['A', 'C', 'E'], ['F', 'A', 'C'], ['G', 'B', 'D']];
const lead = [];
const bass = [];
for (let bar = 0; bar < 8; bar++) {
  const [root, third, fifth] = CHORDS[bar % 4];
  const base = root === 'A' || root === 'F' || root === 'G' ? 4 : 5;
  const up = (n, oct) => `${n}${oct + (SEMITONES[n] < SEMITONES[root] ? 1 : 0)}`;
  const shape = bar < 4 ? [root, third, fifth, third, root, third, fifth, third] : [root, fifth, third, fifth, root, fifth, third, root];
  shape.forEach((n, i) => lead.push(up(n, base + (bar >= 4 && i % 4 === 3 ? 1 : 0))));
  for (let i = 0; i < 8; i++) bass.push(i % 2 === 0 ? `${root}${base - 2}` : null);
}

const total = Math.round(lead.length * STEP * RATE);
const samples = new Float32Array(total);
const voice = (notes, wave, level) => {
  notes.forEach((note, i) => {
    if (!note) return;
    const f = hz(note);
    const start = Math.round(i * STEP * RATE);
    const length = Math.round(STEP * RATE * 0.92);
    for (let n = 0; n < length && start + n < total; n++) {
      const t = n / RATE;
      const phase = (t * f) % 1;
      const value = wave === 'square' ? (phase < 0.5 ? 1 : -1) : 4 * Math.abs(phase - 0.5) - 1;
      // A quick attack and a fade, so notes do not click.
      const env = Math.min(1, n / 80) * Math.min(1, (length - n) / 400) * (0.75 + 0.25 * Math.exp(-t * 12));
      samples[start + n] += value * env * level;
    }
  });
};
voice(lead, 'square', 0.16);
voice(bass, 'triangle', 0.3);

// 16-bit mono WAV.
const wav = Buffer.alloc(44 + total * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + total * 2, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(total * 2, 40);
for (let i = 0; i < total; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);

const dir = mkdtempSync(path.join(tmpdir(), 'tune-'));
const wavFile = path.join(dir, 'tune.wav');
writeFileSync(wavFile, wav);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavFile, '-codec:a', 'libmp3lame', '-q:a', '6', 'music/published/placeholder-tune.mp3']);
rmSync(dir, { recursive: true });
console.log(`music/published/placeholder-tune.mp3: ${(total / RATE).toFixed(1)} s`);
