// Reads the names of every experience entry and project out of src/constants/index.tsx.
// The file is read as text on purpose: it is TSX with path aliases and is never imported here.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_DIR } from './config.mjs';

const EXPERIENCE_KEYS = ['institute', 'company', 'organization', 'organisation', 'org', 'employer', 'name', 'title'];
const PROJECT_KEYS = ['title', 'name'];

/** Replaces comments with spaces while leaving string contents alone. */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      const end = endOfString(src, i);
      out += src.slice(i, end);
      i = end;
    } else if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just past the string literal that starts at `start`. */
function endOfString(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') i += 2;
    else if (src[i] === quote) return i + 1;
    else i++;
  }
  return src.length;
}

/** Index of the bracket that closes the one at `open`, skipping strings. */
function matchBracket(src, open) {
  const pairs = { '[': ']', '{': '}', '(': ')' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = endOfString(src, i) - 1;
    } else if (pairs[c]) {
      stack.push(pairs[c]);
    } else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/** The object literals that are direct members of the array or object literal `body` (which includes its brackets). */
function memberObjects(body) {
  const found = [];
  for (let i = 1; i < body.length - 1; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') i = endOfString(body, i) - 1;
    else if (c === '{' || c === '[' || c === '(') {
      const end = matchBracket(body, i);
      if (end === -1) break;
      if (c === '{') found.push(body.slice(i, end + 1));
      i = end;
    }
  }
  return found;
}

function unescape(raw) {
  return raw.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|[\s\S])/g, (m, body, braced, u4, x2) => {
    if (braced) return String.fromCodePoint(parseInt(braced, 16));
    if (u4) return String.fromCharCode(parseInt(u4, 16));
    if (x2) return String.fromCharCode(parseInt(x2, 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[body] ?? body;
  });
}

/** First string value of the first key in `keys` that the object literal has. */
function stringProp(objectText, keys) {
  const re = /(?:^|[{,\s])(["']?)([A-Za-z_$][\w$]*)\1\s*:\s*(["'`])((?:\\[\s\S]|(?!\3)[^\\])*)\3/g;
  const props = new Map();
  for (const m of objectText.matchAll(re)) if (!props.has(m[2])) props.set(m[2], unescape(m[4]));
  for (const key of keys) {
    const value = props.get(key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function namesFrom(src, nameTest, keys) {
  const names = [];
  const declaration = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+?)?=\s*([[{])/g;
  for (const m of src.matchAll(declaration)) {
    if (!nameTest.test(m[1])) continue;
    const open = m.index + m[0].length - 1;
    const close = matchBracket(src, open);
    if (close === -1) continue;
    for (const objectText of memberObjects(src.slice(open, close + 1))) {
      const name = stringProp(objectText, keys);
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

export async function loadContentNames(file = path.join(PROJECT_DIR, 'src', 'constants', 'index.tsx')) {
  const shown = path.relative(PROJECT_DIR, file) || file;
  const out = { file: shown, experience: [], projects: [], problems: [] };
  let src;
  try {
    src = stripComments(await readFile(file, 'utf8'));
  } catch (error) {
    out.problems.push(`${shown} could not be read: ${error.message}`);
    return out;
  }
  out.experience = namesFrom(src, /experience/i, EXPERIENCE_KEYS);
  out.projects = namesFrom(src, /project/i, PROJECT_KEYS);
  if (!out.experience.length) out.problems.push(`no experience entries found in ${shown} (looked for an array or object whose name contains "experience")`);
  if (!out.projects.length) out.problems.push(`no projects found in ${shown} (looked for an array or object whose name contains "project")`);
  return out;
}
