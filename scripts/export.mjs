#!/usr/bin/env node
// Optional MP4 export: renders frames with Playwright, encodes with ffmpeg.
// NOT run in the sandbox this pack was authored in (no chromium/ffmpeg there).
// Setup on your machine:  npm i -D playwright && npx playwright install chromium  (+ ffmpeg on PATH)
// Usage:                  node scripts/export.mjs --file template-code.html --fps 60 --out short.mp4
//   Opsional teks:         --title 'Judul' --sub 'Subjudul' --end 'Baris 1\nBaris 2'  (sama seperti editor teks di studio)
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
const args = {};
argv.forEach((v, i) => { if (v.startsWith('--')) args[v.slice(2)] = argv[i + 1]; });

const file = args.file || 'template-code.html';
const fps = Number(args.fps || 60);
const out = resolve(args.out || 'short.mp4');
const scale = Number(args.scale || 2);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Regex sama dengan setText() di studio.js — jaga keduanya tetap sinkron.
const toHtml = (v) => esc(v).replace(/\n/g, '<br>');
const nl = (s) => String(s).replace(/\\n/g, '\n'); // CLI menulis newline sebagai \n
function setText(html, f) {
  let h = html;
  /* <small> bisa punya atribut (id="sub"), jadi jangan hard-code "<small>". */
  if (f.title !== undefined) {
    h = h.replace(/(<div id="title">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (m, a, b, c) => a + toHtml(nl(f.title)) + c);
  }
  if (f.sub !== undefined) {
    h = h.replace(/(<div id="title">[\s\S]*?<small\b[^>]*>)([\s\S]*?)(<\/small><\/div>)/,
      (m, a, b, c) => a + esc(nl(f.sub)) + c);
  }
  if (f.end !== undefined) {
    /* Pertahankan baris kredit <b class="cr"> dan <small> bawaan template. */
    h = h.replace(/(<div id="end">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<b class="cr">[\s\S]*?<\/b>)?(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (m, a, b, cr, c) => a + toHtml(nl(f.end)) + (cr || '') + c);
  }
  return h;
}
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Playwright belum terpasang. Jalankan: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const dir = await mkdtemp(join(tmpdir(), 'short-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: scale });
const src = await readFile(join(ROOT, 'public', 'templates', file), 'utf8');
const html = setText(src, { title: args.title, sub: args.sub, end: args.end });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.renderAt === 'function', null, { timeout: 20000 });

const LEN = await page.evaluate(() => (typeof LEN === 'number' ? LEN : 30));
const stage = await page.$('#stage');
if (args.title || args.sub || args.end) console.log('teks kustom diterapkan');
console.log(`render ${file} · ${LEN}s · ${fps}fps → ${out}`);

const total = Math.floor(LEN * fps);
for (let i = 0; i <= total; i++) {
  const t = i / fps;
  await page.evaluate((t) => {
    const go = document.getElementById('go');
    if (go) go.style.display = 'none';
    window.renderAt(t);
  }, t);
  await stage.screenshot({ path: join(dir, `f_${String(i).padStart(5, '0')}.png`) });
  if (i % 120 === 0) process.stdout.write(`  ${t.toFixed(1)}s / ${LEN}s\r`);
}
await browser.close();

await new Promise((ok, bad) => {
  const ff = spawn('ffmpeg', ['-y', '-framerate', String(fps), '-i', join(dir, 'f_%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out], { stdio: 'inherit' });
  ff.on('exit', (c) => (c ? bad(new Error('ffmpeg exit ' + c)) : ok()));
});
await rm(dir, { recursive: true, force: true });
console.log(`selesai → ${out} (video tanpa audio: Web Speech tidak bisa dirender; mux TTS offline kalau butuh narasi)`);
