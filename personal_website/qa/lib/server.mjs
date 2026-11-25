// Starts and stops the site under test: a production build served by `vite preview`, or the Vite dev server.
// The port is picked here first and passed with --strictPort, so several runs can go at once.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PROJECT_DIR } from './config.mjs';
import { sleep } from './util.mjs';

const HOST = '127.0.0.1';
const BUILD_MS = 180_000;
const START_MS = 30_000;

export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * The project's own Vite binary, run directly: it is what `npx vite` resolves to, without npx as an
 * extra process in between. npx is the fallback when the binary is not where it is expected.
 */
function viteCommand(args) {
  const bin = path.join('node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const shownArgs = args.map((a) => (path.isAbsolute(a) ? path.relative(PROJECT_DIR, a) || '.' : a)).join(' ');
  if (existsSync(path.join(PROJECT_DIR, bin))) return { cmd: path.join(PROJECT_DIR, bin), args, shown: `${bin} ${shownArgs}` };
  return { cmd: 'npx', args: ['--no-install', 'vite', ...args], shown: `npx --no-install vite ${shownArgs}` };
}

/** Children get their own process group so the whole tree (npx, node, esbuild) can be stopped at once. */
function launch({ cmd, args }) {
  const child = spawn(cmd, args, {
    cwd: PROJECT_DIR,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  const output = [];
  const keep = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 400) output.splice(0, output.length - 400);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
    child.on('error', (error) => {
      keep(`${error.message}\n`);
      resolve({ code: -1, signal: null });
    });
  });
  return { child, exited, text: () => output.join('') };
}

function signalGroup(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

const tail = (text, lines = 25) => text.trim().split('\n').slice(-lines).join('\n');

async function responds(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Holds every child process this run started. `stop()` is safe to call more than once and
 * `killNow()` is the synchronous last resort for process exit.
 */
export class SiteServer {
  constructor({ mode, runDir, log = () => {} }) {
    this.mode = mode;
    this.runDir = runDir;
    this.log = log;
    this.children = new Set();
    this.base = null;
    this.port = null;
    this.commands = [];
    this.stopped = false;
  }

  async start() {
    if (this.mode === 'preview') await this.build();
    let lastError = null;
    for (let attempt = 1; attempt <= 3 && !this.stopped; attempt++) {
      const port = await freePort();
      try {
        await this.serve(port);
        return this.base;
      } catch (error) {
        lastError = error;
        if (!error.portTaken) break;
        this.log(`port ${port} was taken before the server could bind it; trying another`);
      }
    }
    throw lastError ?? new Error('the server was stopped before it started');
  }

  async build() {
    const outDir = path.join(this.runDir, 'dist');
    const command = viteCommand(['build', '--outDir', outDir, '--emptyOutDir']);
    this.commands.push(command.shown);
    this.log(`building: ${command.shown}`);
    const proc = launch(command);
    this.children.add(proc.child);
    const timer = setTimeout(() => signalGroup(proc.child, 'SIGKILL'), BUILD_MS);
    const { code, signal } = await proc.exited;
    clearTimeout(timer);
    this.children.delete(proc.child);
    if (code !== 0) {
      const why = signal ? `was stopped by ${signal}` : `exited with code ${code}`;
      throw new Error(`the production build ${why}:\n${tail(proc.text())}`);
    }
  }

  async serve(port) {
    const args =
      this.mode === 'preview'
        ? ['preview', '--outDir', path.join(this.runDir, 'dist'), '--port', String(port), '--strictPort', '--host', HOST]
        : ['--port', String(port), '--strictPort', '--host', HOST];
    const command = viteCommand(args);
    this.commands.push(command.shown);
    this.log(`starting: ${command.shown}`);
    const proc = launch(command);
    this.children.add(proc.child);
    let exit = null;
    proc.exited.then((result) => {
      exit = result;
      this.children.delete(proc.child);
    });

    const url = `http://${HOST}:${port}/`;
    const deadline = Date.now() + START_MS;
    while (Date.now() < deadline && !exit && !this.stopped) {
      if (await responds(url)) {
        // Make sure it is our server answering and not something that grabbed the port first.
        await sleep(50);
        if (exit) break;
        this.base = url;
        this.port = port;
        this.proc = proc;
        return;
      }
      await sleep(100);
    }
    const text = proc.text();
    await this.end(proc);
    const error = new Error(
      exit
        ? `the ${this.mode} server exited with code ${exit.code} before it answered:\n${tail(text)}`
        : `the ${this.mode} server did not answer on ${url} within ${START_MS / 1000} s:\n${tail(text)}`,
    );
    error.portTaken = /already in use|EADDRINUSE/i.test(text);
    throw error;
  }

  async end(proc) {
    const gone = proc.exited.then(() => true);
    signalGroup(proc.child, 'SIGTERM');
    if (!(await Promise.race([gone, sleep(3000).then(() => false)]))) {
      signalGroup(proc.child, 'SIGKILL');
      await Promise.race([gone, sleep(2000)]);
    }
    this.children.delete(proc.child);
  }

  /** Stops everything this run started and waits until the port is free again. */
  async stop() {
    this.stopped = true;
    const procs = [...this.children];
    await Promise.all(
      procs.map((child) =>
        this.end({ child, exited: new Promise((resolve) => (child.exitCode !== null || child.signalCode ? resolve() : child.once('exit', resolve))) }),
      ),
    );
    if (this.port) {
      for (let i = 0; i < 20 && (await responds(`http://${HOST}:${this.port}/`)); i++) await sleep(100);
    }
  }

  killNow() {
    for (const child of this.children) signalGroup(child, 'SIGKILL');
    this.children.clear();
  }
}
