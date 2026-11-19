#!/usr/bin/env node
// Optional MP4 export: renders frames with Playwright, encodes with ffmpeg.
// NOT run in the sandbox this pack was authored in (no chromium/ffmpeg there).
// Setup on your machine:  npm i -D playwright && npx playwright install chromium  (+ ffmpeg on PATH)
// Usage:                  node scripts/export.mjs --file template-code.html --fps 60 --out short.mp4
//   Opsional teks:         --title 'Judul' --sub 'Subjudul' --end 'Baris 1\nBaris 2'  (sama seperti editor teks di studio)
//   Spec edit lengkap:     --edit spec.json  (format kanonik — lihat scripts/apply-edit.mjs;
//                          bila --edit dipakai, --title/--sub/--end individual DIABAIKAN
//                          kecuali ada di JSON. Logika terapnya diimpor dari apply-edit.mjs,
//                          yang sinkron dengan lib/studio.ts — jangan duplikasi di sini.)
//   Cek hasil edit saja:   --edit spec.json --dry-run [--out-html out.html]
//                          (tulis HTML hasil edit tanpa me-render; tanpa butuh Playwright)
//   CATATAN VENDOR (2026-11-19): HTML hasil skrip ini SENGAJA tetap pakai
//   URL CDN three.js (bukan /vendor/) — file hasil export/unduh harus
//   standalone. Rewrite CDN->/vendor/ hanya untuk PREVIEW di Studio
//   (lib/studio.ts rewriteThreeCdnToLocal, dipanggil mount() di
//   components/Studio.tsx). Lihat "Vendor three.js" di README.md.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEdits, validateCaps, validateShots, validateProps } from './apply-edit.mjs';

const argv = process.argv.slice(2);
const args = {};
argv.forEach((v, i) => { if (v.startsWith('--')) args[v.slice(2)] = argv[i + 1]; });

const file = args.file || 'template-code.html';
const fps = Number(args.fps || 60);
const out = resolve(args.out || 'short.mp4');
const scale = Number(args.scale || 2);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const src = await readFile(join(ROOT, 'public', 'templates', file), 'utf8');
const lens = [...src.matchAll(/LEN=([0-9.]+)/g)].map((m) => +m[1]);
const LEN0 = lens[lens.length - 1] || 30;

// Spec edit: dari --edit (menang atas flag individual) atau dari flag teks.
let spec;
if (args.edit) {
  spec = JSON.parse(await readFile(resolve(args.edit), 'utf8'));
  spec = { ...spec, file };
} else {
  spec = { file };
  if (args.title !== undefined) spec.title = args.title;
  if (args.sub !== undefined) spec.sub = args.sub;
  if (args.end !== undefined) spec.end = args.end;
}
if (spec.caps || spec.shots || spec.props || spec.vo || spec.title || spec.sub || spec.end) {
  const errs = [];
  const warns = [];
  if (spec.caps) { const v = validateCaps(spec.caps, LEN0); errs.push(...v.errors); warns.push(...v.warnings); }
  if (spec.shots) { const v = validateShots(spec.shots, LEN0); errs.push(...v.errors); warns.push(...v.warnings); }
  if (spec.props) { const v = validateProps(spec.props, file, LEN0); errs.push(...v.errors); warns.push(...v.warnings); }
  warns.forEach((w) => console.warn('peringatan: ' + w));
  if (errs.length) { errs.forEach((e) => console.error('error: ' + e)); process.exit(1); }
}
const applied = applyEdits(src, spec, LEN0);
if (!applied.ok) { console.error('error: gagal menerapkan edit: ' + applied.failed.join(', ')); process.exit(1); }
const html = applied.html;
if (applied.applied.length) console.log(`edit diterapkan: ${applied.applied.join(', ')}${applied.voFollowedCaps ? ' · VO mengikuti teks caption' : ''}`);

if (argv.includes('--dry-run')) {
  const outHtml = resolve(args['out-html'] || file.replace(/\.html$/, '') + '-edited.html');
  await writeFile(outHtml, html, 'utf8');
  console.log(`dry-run → ${outHtml} (HTML hasil edit, tanpa render)`);
  process.exit(0);
}

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Playwright belum terpasang. Jalankan: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const dir = await mkdtemp(join(tmpdir(), 'short-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: scale });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.renderAt === 'function', null, { timeout: 20000 });

const LEN = await page.evaluate(() => (typeof LEN === 'number' ? LEN : 30));
const stage = await page.$('#stage');
if (args.title || args.sub || args.end || args.edit) console.log('teks/edit kustom diterapkan');
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
