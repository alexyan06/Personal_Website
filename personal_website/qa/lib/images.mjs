// Image work without an image library: a blank helper page in the same headless browser
// decodes PNGs on a canvas. Used for the focus-indicator pixel diff, for reading what a screenshot
// shows in a region (the ground checks) and for film-strip contact sheets.

export class Images {
  constructor(browser) {
    this.browser = browser;
    this.context = null;
    this.page = null;
    this.queue = Promise.resolve();
  }

  async helper() {
    if (this.page && !this.page.isClosed()) return this.page;
    this.context = await this.browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
    this.context.setDefaultTimeout(8000);
    this.page = await this.context.newPage();
    return this.page;
  }

  /** Runs jobs one at a time, since they share one helper page. */
  run(job) {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }

  /**
   * Counts the pixels that differ between two same-size PNG buffers inside `region`
   * ({ x, y, w, h } in image pixels). Returns { changed, total } or null when it cannot compare.
   */
  diff(before, after, region) {
    return this.run(async () => {
      const page = await this.helper();
      return page.evaluate(
        async ({ a, b, region }) => {
          const decode = async (b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          };
          const [ia, ib] = await Promise.all([decode(a), decode(b)]);
          if (ia.width !== ib.width || ia.height !== ib.height) return null;
          const x = Math.max(0, Math.floor(region.x));
          const y = Math.max(0, Math.floor(region.y));
          const w = Math.min(ia.width - x, Math.ceil(region.w));
          const h = Math.min(ia.height - y, Math.ceil(region.h));
          if (w <= 0 || h <= 0) return null;
          const pixels = (image) => {
            const canvas = new OffscreenCanvas(w, h);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
            return ctx.getImageData(0, 0, w, h).data;
          };
          const da = pixels(ia);
          const db = pixels(ib);
          let changed = 0;
          for (let i = 0; i < da.length; i += 4) {
            if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) changed++;
          }
          return { changed, total: w * h };
        },
        { a: before.toString('base64'), b: after.toString('base64'), region },
      );
    });
  }

  /**
   * What a screenshot shows in each of `regions` ({ name, x, y, w, h } in image pixels): how many
   * pixels there are, how many of them have (nearly) the color `flat` ([r, g, b]), and how many
   * differ from the region's own most common color. Returns [{ name, total, flat, other, mode }]
   * or null when the image cannot be read.
   */
  stats(png, regions, flat = null) {
    return this.run(async () => {
      const page = await this.helper();
      return page.evaluate(
        async ({ b64, regions, flat }) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const out = [];
          for (const region of regions) {
            const x = Math.max(0, Math.floor(region.x));
            const y = Math.max(0, Math.floor(region.y));
            const w = Math.min(image.width - x, Math.ceil(region.w));
            const h = Math.min(image.height - y, Math.ceil(region.h));
            if (w <= 0 || h <= 0) {
              out.push({ name: region.name, total: 0, flat: 0, other: 0, mode: null });
              continue;
            }
            const canvas = new OffscreenCanvas(w, h);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
            const d = ctx.getImageData(0, 0, w, h).data;
            const counts = new Map();
            let flatCount = 0;
            for (let i = 0; i < d.length; i += 4) {
              const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
              counts.set(key, (counts.get(key) ?? 0) + 1);
              if (flat && Math.abs(d[i] - flat[0]) <= 10 && Math.abs(d[i + 1] - flat[1]) <= 10 && Math.abs(d[i + 2] - flat[2]) <= 10) flatCount++;
            }
            let mode = 0;
            let most = -1;
            for (const [key, n] of counts) {
              if (n > most) {
                most = n;
                mode = key;
              }
            }
            const m = [(mode >> 16) & 255, (mode >> 8) & 255, mode & 255];
            let other = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (Math.abs(d[i] - m[0]) + Math.abs(d[i + 1] - m[1]) + Math.abs(d[i + 2] - m[2]) > 36) other++;
            }
            out.push({ name: region.name, total: w * h, flat: flatCount, other, mode: m });
          }
          return out;
        },
        { b64: png.toString('base64'), regions, flat },
      );
    });
  }

  /** Lays frames out in one PNG, three to a row, each with its caption. */
  contactSheet(frames, outPath, title) {
    return this.run(async () => {
      const page = await this.helper();
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      const cells = frames
        .map(
          (f) =>
            `<figure><img src="data:image/png;base64,${f.buffer.toString('base64')}"><figcaption>${esc(f.caption)}</figcaption></figure>`,
        )
        .join('');
      await page.setContent(
        `<!doctype html><meta charset="utf-8"><style>
          html{background:#202020}
          body{margin:0;padding:12px;background:#202020;color:#f0f0f0;font:13px/1.4 ui-monospace,Menlo,monospace;width:1200px;box-sizing:border-box}
          h1{font-size:14px;margin:0 0 10px;font-weight:600}
          main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
          figure{margin:0} img{display:block;width:100%;outline:1px solid #555}
          figcaption{padding:4px 0 0}
        </style><h1>${esc(title)}</h1><main>${cells}</main>`,
        { waitUntil: 'load' },
      );
      await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 5000 }).catch(() => {});
      await page.locator('body').screenshot({ path: outPath });
      await page.setContent('<!doctype html><title>idle</title>');
    });
  }

  async close() {
    await this.context?.close().catch(() => {});
    this.context = null;
    this.page = null;
  }
}
