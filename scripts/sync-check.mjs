#!/usr/bin/env node
// Uji sinkronisasi lib/studio.ts vs scripts/apply-edit.mjs (rekonsiliasi 2026-11-17).
// Untuk semua 12 template: spec yang sama (teks + caps + shots + vo + props,
// termasuk minimal satu prop array baru bila tersedia) harus menghasilkan
// HTML BYTE-IDENTIK antara lib applyEdits dan apply-edit.mjs (modul maupun CLI).
// Juga: --list-props harus menampilkan props untuk semua 12 template, dan
// contoh spec di scripts/examples/ harus exit 0.
//   node scripts/sync-check.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mjs from './apply-edit.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TPL_DIR = join(ROOT, 'public', 'templates');
const TMP = '/tmp/sync-check';
const LIB_DIR = join(TMP, 'lib');

const fail = (msg) => { console.error(`sync-check: FAIL: ${msg}`); process.exitCode = 1; };

// ---- 1. Kompilasi lib/studio.ts ke /tmp (CommonJS) ----
mkdirSync(LIB_DIR, { recursive: true });
mkdirSync(join(TMP, 'public'), { recursive: true });
cpSync(join(ROOT, 'public', 'templates.json'), join(TMP, 'public', 'templates.json'));
try {
  execFileSync(join(ROOT, 'node_modules', '.bin', 'tsc'), [
    join(ROOT, 'lib', 'studio.ts'),
    '--outDir', LIB_DIR,
    '--module', 'commonjs',
    '--target', 'es2020',
    '--resolveJsonModule',
    '--esModuleInterop',
    '--skipLibCheck',
    '--moduleResolution', 'node',
    '--lib', 'dom,es2020',
  ], { stdio: 'pipe' });
} catch (e) {
  fail(`kompilasi lib/studio.ts gagal: ${String(e.stderr || e.message).slice(0, 500)}`);
  process.exit(1);
}
const lib = await import(join(LIB_DIR, 'lib', 'studio.js')); // tsc mirror struktur repo (rootDir = repo)

console.log(`PROP_DEFS lib=${lib.PROP_DEFS.length} mjs=${mjs.PROP_DEFS.length}`);
if (lib.PROP_DEFS.length !== mjs.PROP_DEFS.length) fail('jumlah PROP_DEFS lib != mjs');
const libIds = lib.PROP_DEFS.map((d) => d.id).sort().join(',');
const mjsIds = mjs.PROP_DEFS.map((d) => d.id).sort().join(',');
if (libIds !== mjsIds) fail(`id PROP_DEFS berbeda:\n  lib: ${libIds}\n  mjs: ${mjsIds}`);

// ---- 2. Bangun spec per template dari nilai aslinya (dengan perubahan kecil yang valid) ----
const registry = JSON.parse(readFileSync(join(ROOT, 'public', 'templates.json'), 'utf8'));
const deep = (v) => JSON.parse(JSON.stringify(v));
const results = [];

for (const t of registry) {
  const file = t.file;
  const html = readFileSync(join(TPL_DIR, file), 'utf8');
  const mLen = html.match(/(?:^|[^\w$])LEN\s*=\s*([\d.]+)/);
  const LEN = mLen ? parseFloat(mLen[1]) : 30;
  const caps = mjs.parseCaps(html);
  const shots = mjs.parseShots(html);
  const vk = mjs.voKind(html);
  const vo = mjs.parseVO(html);
  const parsedProps = mjs.parseProps(html, file);

  const spec = { file, title: 'Tes Sinkronisasi', sub: 'lib vs cli', end: 'Akhir tes sinkronisasi' };
  if (caps) {
    const c = deep(caps);
    // Ganti teks caption pertama (2 kata — aman untuk kata/detik di semua template).
    c[0][2] = 'Tes sinkronisasi.';
    spec.caps = c;
  }
  if (shots) {
    const s = deep(shots);
    s[0][1][1] = Math.round((s[0][1][1] + 0.05) * 1000) / 1000;
    spec.shots = s;
  }
  if (vk === 'literal' && vo) {
    const v = deep(vo);
    v[0] = 'Tes sinkronisasi.';
    spec.vo = v;
  }
  // Props: semua prop yang tersedia, dengan perubahan kecil yang valid.
  const props = {};
  let newArrayTouched = false;
  for (const p of parsedProps) {
    if (!p.available) continue;
    const def = p.def;
    const v = deep(p.value);
    if (def.kind === 'number') {
      if (['claude.x', 'codex.x', 'gemini.x', 'fort.distance', 'catapult.distance'].includes(def.id) || def.id.startsWith('monitor.')) {
        props[def.id] = v; // posisi maskot/monitor: round-trip (hindari risiko gap/framing)
      } else if (def.id === 'meeting.end') {
        props[def.id] = Math.round((v + 0.1) * 1000) / 1000;
      } else {
        // Rentang bisa berbeda per template (rangeByFile) — pakai rentang
        // file ini supaya nilai hasil naik tetap valid.
        const r = (def.rangeByFile && def.rangeByFile[file]) || def;
        const step = r.step || 0.05;
        let nv = Math.round((v + step) * 1000) / 1000;
        if (r.max !== undefined) nv = Math.min(nv, r.max);
        if (r.min !== undefined) nv = Math.max(nv, r.min);
        props[def.id] = nv;
      }
    } else if (def.kind === 'color') {
      props[def.id] = '#112233';
    } else if (def.kind === 'array') {
      newArrayTouched = true;
      if (def.id.startsWith('board.')) {
        v[0] = Math.min(100, v[0] + 1);
      } else if (def.id === 'tank.curve') {
        v[2][1] = Math.min(100, v[2][1] + 1);
      } else if (def.id === 'rival.notes') {
        v[0].tx[0] = 'tes sinkron';
      } else if (def.id === 'war.spawns') {
        v[0][0] = Math.round((v[0][0] + 0.1) * 1000) / 1000;
      } else if (def.id === 'war.catapults') {
        v[0][1] = Math.round((v[0][1] + 0.1) * 1000) / 1000;
      } else if (def.id === 'typing.windows') {
        const last = v[v.length - 1];
        last[1] = Math.round((last[1] + 0.1) * 1000) / 1000;
      } else if (def.id === 'typing.lines') {
        v[0][0] = '$ echo tes sinkron';
      }
      props[def.id] = v;
    } else if (def.kind === 'text') {
      props[def.id] = v; // teks: round-trip (nilai asli ditulis kembali)
    }
  }
  spec.props = props;

  // Validasi kedua sisi dengan LEN yang benar (harus lolos semua).
  const vLib = lib.validateProps(props, file, LEN);
  const vMjs = mjs.validateProps(props, file, LEN);
  if (vLib.errors.length) fail(`${file}: validateProps lib error: ${vLib.errors.join(' | ')}`);
  if (vMjs.errors.length) fail(`${file}: validateProps mjs error: ${vMjs.errors.join(' | ')}`);
  if (JSON.stringify(vLib) !== JSON.stringify(vMjs)) fail(`${file}: validateProps lib != mjs`);

  // Terapkan di kedua sisi (modul).
  const rLib = lib.applyEdits(html, spec, LEN);
  const rMjs = mjs.applyEdits(html, spec, LEN);
  if (!rLib.ok) fail(`${file}: lib applyEdits gagal: ${rLib.failed.join(', ')}`);
  if (!rMjs.ok) fail(`${file}: mjs applyEdits gagal: ${rMjs.failed.join(', ')}`);
  const sameModule = rLib.html === rMjs.html;

  // Terapkan via CLI .mjs (validasi keras + node --check + kredit).
  const specPath = join(TMP, `spec-${file}`);
  const outPath = join(TMP, `out-${file}`);
  writeFileSync(specPath, JSON.stringify(spec));
  const cli = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apply-edit.mjs'), '--file', file, '--edit', specPath, '--out', outPath], { encoding: 'utf8' });
  const cliOut = cli.status === 0 ? readFileSync(outPath, 'utf8') : null;
  const sameCli = cliOut !== null && cliOut === rLib.html;

  // Bentuk array (alias lama) harus memberi hasil yang sama di kedua sisi.
  const specArr = { ...spec, props: Object.entries(props).map(([id, value]) => ({ id, value })) };
  const rLibArr = lib.applyEdits(html, specArr, LEN);
  const rMjsArr = mjs.applyEdits(html, specArr, LEN);
  const sameAlias = rLibArr.html === rLib.html && rMjsArr.html === rMjs.html;

  // --list-props harus menampilkan props untuk template ini.
  const lp = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apply-edit.mjs'), '--list-props', join(TPL_DIR, file)], { encoding: 'utf8' });
  const lpOk = lp.status === 0 && lp.stdout.includes('props yang bisa diedit:') && /claude\.color = /.test(lp.stdout);

  const ok = sameModule && sameCli && sameAlias && lpOk && cli.status === 0;
  if (!sameModule) fail(`${file}: lib != mjs (modul)`);
  if (cli.status !== 0) fail(`${file}: CLI exit ${cli.status}: ${(cli.stderr || cli.stdout || '').slice(0, 300)}`);
  if (!sameCli) fail(`${file}: CLI != lib (byte)`);
  if (!sameAlias) fail(`${file}: bentuk array != bentuk object`);
  if (!lpOk) fail(`${file}: --list-props tidak menampilkan props`);
  results.push({ file, ok, newArrayTouched, availProps: parsedProps.filter((p) => p.available).length });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${file} byte-identik=${sameModule && sameCli} alias-sama=${sameAlias} list-props=${lpOk} props-tersedia=${parsedProps.filter((p) => p.available).length} prop-array-baru=${newArrayTouched ? 'ya' : 'tidak ada'}`);
}

// ---- 3. Contoh spec di scripts/examples/ harus exit 0 ----
for (const [ex, f] of [['spec-code-pr-kecil.json', 'template-code.html'], ['spec-kuota-hemat.json', 'template-kuota.html']]) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apply-edit.mjs'), '--file', f, '--edit', join(ROOT, 'scripts', 'examples', ex), '--out', join(TMP, `ex-${f}`)], { encoding: 'utf8' });
  console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'} examples/${ex} exit=${r.status}`);
  if (r.status !== 0) fail(`examples/${ex} exit ${r.status}: ${(r.stderr || '').slice(0, 300)}`);
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} template byte-identik lib == mjs (modul + CLI + alias array).`);
if (bad.length) fail(`${bad.length} template gagal: ${bad.map((r) => r.file).join(', ')}`);
if (process.exitCode) console.log('sync-check: ADA KEGAGALAN (lihat FAIL di atas)');
else console.log('sync-check: SEMUA HIJAU');
