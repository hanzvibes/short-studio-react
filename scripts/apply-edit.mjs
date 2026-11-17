#!/usr/bin/env node
// Terapkan spec edit kanonik ke satu file template HTML (tanpa me-render).
//   node scripts/apply-edit.mjs --file template-code.html --edit spec.json --out out.html
//   node scripts/apply-edit.mjs --file template-code.html --title 'Judul' --sub 'Sub' --end 'Akhir' --out out.html
//   node scripts/apply-edit.mjs --list-props template-code.html
// Spec kanonik (SAMA dengan lib/studio.ts — EditSpec, dengan SATU tambahan):
//   { "file":"template-code.html", "title":"...", "sub":"...", "end":"...",
//     "caps":[[t0,t1,"teks",speaker?],...],
//     "shots":[[t0,[x,y,z],[x,y,z]],...],
//     "vo":["...",...],
//     "props":{...atau [...] } }
// - "props" menerima DUA bentuk (keduanya dinormalisasi ke map id -> nilai
//   oleh normalizeProps(), di dalam applyEdits/setProps/validateProps):
//   (a) KANONIK: object {"claude.x": -1.5, "codex.color": "#7b8cff", ...}
//       — bentuk ini yang ditulis di SKILL.md dan lib/studio.ts.
//   (b) ALIAS LAMA: array [{"id":"claude.x","value":-1.5}, ...]
//       — tetap diterima; duplikat id = error.
//   Koordinator menyelaraskan keduanya 2026-11-17 (dulu kanoniknya array);
//   CLI dan lib menerima keduanya dengan hasil yang sama.
// - "vo" opsional: bila caps diedit dan vo tidak diisi, VO[i] := teks caps
//   baru (VO literal diganti + peringatan dicetak; VO turunan
//   `caps.map(c=>c[2])` mengikuti otomatis). Bila "vo" diisi pada template
//   VO turunan, ekspresi turunan diganti array literal SEKALI (setVO) —
//   edit caps berikutnya tetap diikuti lewat aturan auto-follow. Panjang vo
//   harus == jumlah caps akhir (divalidasi keras di CLI).
// - "caps"/"shots"/"vo" MENGGANTIKAN SELURUH array di template (bukan patch
//   per baris): selalu tulis array lengkap. Arity caps mengikuti template
//   (3 = [t0,t1,teks], 4 = [t0,t1,teks,speaker]); arity salah = error.
// - Daftar id props + sumber literal tiap template: jalankan --list-props.
//   Agent TIDAK BOLEH menebak id props (lihat matriks di SKILL.md).
//
// ==== SINKRONISASI dengan lib/studio.ts ====
// Fungsi set*/parse*/validate* di file ini adalah DUPLIKASI dari
// lib/studio.ts (TypeScript). Bila mengubah salah satu, ubah yang lain:
// setText (regex sama dengan setText() di lib/studio.ts), bracket-matching
// findArraySpan, parser literal parseJsArray, setCaps/setShots/setVO,
// setProps + PROP_DEFS, validateCaps/validateShots/validateProps, applyEdits.
// PERBEDAAN YANG DISENGAJA (dicatat supaya koordinator bisa menyelaraskan):
//  1. CLI ini memberlakukan kata/detik > 2.5 sebagai ERROR (tugas skill:
//     validasi gagal keras = exit non-zero, tanpa output). validateCaps()
//     di kedua file menandainya WARNING saja (untuk UI Studio).
//  2. CLI ini menerima props bentuk object (kanonik) + array (alias lama),
//     dinormalisasi di dalam applyEdits/setProps/validateProps — SAMA
//     seperti lib/studio.ts (diselaraskan 2026-11-17; dulu kanoniknya array).
//  3. PERBAIKAN YANG SUDAH DIPORT KE lib/studio.ts (2026-11-17, rekonsiliasi):
//     (a) monitor trio TERTUKAR di lib: monitor.codex.x anchorByFile trio
//         index 2 (salah; panggilan mkMon trio berurutan monL=-2.6 [0],
//         monR=0 [1], monG=2.6 [2] — Codex = index 1) dan monitor.gemini.x
//         index 1 (salah; Gemini = index 2). Di kedua file sudah benar
//         (codex = mkMon index 1, gemini = mkMon index 2).
//     (b) perang: codex.scale di lib menunjuk dm.scale.setScalar(.85),
//         padahal frame() perang menimpa G[i].scale dari gs[i] tiap frame
//         (baris 287) sehingga edit itu TIDAK TERLIHAT. Di kedua file
//         codex.scale perang -> gs[1], dan claude.scale (baru, perang saja)
//         -> gs[0]. Di template lain dm.scale.setScalar tetap efektif
//         (tidak ada penimpaan G[i].scale di frame()).
//     (c) Def baru (dulu HANYA di file ini, kini juga di lib): board.claude.start/
//         board.claude.final/board.codex.start/board.codex.final (CL0/CL1/
//         CX0/CX1, template-code), tank.curve (RK, kuota), rival.notes (NT,
//         rival), war.spawns (SP) + war.catapults (EV) (perang),
//         typing.windows (WIN) + typing.lines (TL) (bughunter/bomb/meeting),
//         meeting.end (MEET_END, meeting). Anchor baru: {t:"whole",name}
//         (ganti seluruh array) dan {t:"assign",name} (ganti satu angka
//         `NAME=...`). parseJsArray di kedua file sudah bisa mem-parse
//         object {...} (untuk NT). Total PROP_DEFS: 29 di kedua file.
//  4. setText() di sini mengubah urutan "\n" literal dari CLI menjadi
//     newline asli (nl()); lib/studio.ts menerima newline asli dari input
//     React sehingga tidak butuh itu.
//
// VALIDASI KERAS CLI (gagal = exit non-zero, TIDAK menulis output):
//  teks: pola #title/#end harus ditemukan; caps: terurut, 0<=t0<t1<=LEN,
//  tidak tumpang tindih, kata/detik <= 2.5, speaker 0..2; shots: terurut,
//  0<=t0<=LEN, [t0,[x,y,z],[x,y,z]]; vo: panjang == jumlah caps; props:
//  id dikenal + tersedia di template ini + nilai dalam rentang (min/max,
//  warna #rrggbb, validator per-def) + validasi silang pada HTML AKHIR
//  (nilai hasil gabungan spec + nilai template yang tidak diubah): gap antar
//  maskot > 0.1 DAN >= 2.5 (anggaran geser-ke-tengah saat argue/joy/typing),
//  framing shot 0 (lebar tampak = 0.975 * jarak kamera; |x| maskot + 0.6
//  <= setengah lebar tampak), gap antar monitor >= 0.2, jendela ketik
//  cukup untuk teksnya (chars/27 detik), meeting.end sesudah jendela ketik
//  terakhir. Sesudah semua edit: SEMUA blok <script> inline diekstrak dan
//  dicek `node --check`; kredit @hanzvibes tidak boleh berkurang. Output
//  TIDAK PERNAH ditulis ke public/templates/ atau menimpa file input.
//
// CARA UJI (dijalankan sebelum klaim hijau):
//  1. node scripts/apply-edit.mjs --file template-code.html \
//       --edit scripts/examples/spec-code-pr-kecil.json --out /tmp/out-code.html
//     (judul/sub/end + 8 caps + 10 shots + props claude.x/claude.color;
//      VO template-code turunan caps.map jadi otomatis mengikuti caps.)
//  2. node scripts/apply-edit.mjs --file template-kuota.html \
//       --edit scripts/examples/spec-kuota-hemat.json --out /tmp/out-kuota.html
//     (teks + 14 caps + 13 shots + vo eksplisit + props tank.curve/codex.x.)
//  3. Ulangi (2) dengan spec yang sama minus field "vo" -> harus ada
//     peringatan "VO[] diperbarui mengikuti teks caps baru" dan VO hasil
//     == teks caps baru.
//  4. node --check pada tiap <script> inline hasil edit (SUDAH dilakukan
//     otomatis di dalam CLI ini; ulangi manual bila mau memeriksa satu blok).
//  5. Headless renderAt: muat out.html di Chromium headless (Playwright,
//     CDN three.js dialihkan ke /tmp/ss-vendor seperti
//     scripts/verify-headless.mjs), panggil window.renderAt(5), renderAt(12),
//     renderAt(23), pastikan tanpa pageerror dan caps/shots terbaca.
//  6. Uji negatif (harus exit non-zero + TIDAK ada file output): caps
//     tumpang tindih, speaker 3, kata/detik > 2.5, gap maskot < 2.5, id props
//     tidak dikenal, props yang tidak tersedia di template itu, --out di
//     dalam public/templates/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TPL_DIR = join(ROOT, 'public', 'templates');
const MAX_WPS = 2.5;         // kata per detik (SKILL.md "Dialogue writing")
const MIN_MASCOT_GAP = 2.5;  // gap statis minimum antar maskot (lihat header)
const MIN_MONITOR_GAP = 0.2; // aturan no-coplanar SKILL.md
const FRAME_MARGIN = 0.6;    // ruang badan+lengan di luar |x| maskot
const TYPE_CPS = 27;         // huruf per detik di jendela ketik (SKILL.md)

// ---------- util ----------
const numFmt = (n) => { const r = Math.round(n * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------- bracket-matching + parser literal (mirror lib/studio.ts) ----------
export function findArraySpan(html, name) {
  const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=');
  const m = re.exec(html);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < html.length && /[ \t]/.test(html[i])) i++;
  if (html[i] !== '[') return null;
  let depth = 0, instr = null, esc = false, lineComment = false, blockComment = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j], nx = html[j + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && nx === '/') { blockComment = false; j++; } continue; }
    if (instr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === instr) instr = null; continue; }
    if (c === '/' && nx === '/') { lineComment = true; continue; }
    if (c === '/' && nx === '*') { blockComment = true; continue; }
    if (c === "'" || c === '"') { instr = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return { start: i, end: j + 1 }; }
  }
  return null;
}

export function parseJsArray(src) {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; }
      else if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) return; i = e + 2; }
      else return;
    }
  };
  const parseString = () => {
    const q = src[i]; i++;
    let out = '';
    while (i < src.length) {
      const c = src[i++];
      if (c === '\\' && i < src.length) {
        const e = src[i++];
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else if (e === 'u') { out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16) || 0); i += 4; }
        else out += e;
        continue;
      }
      if (c === q) return out;
      out += c;
    }
    return null;
  };
  const parseValue = () => {
    skip();
    const c = src[i];
    if (c === '[') {
      i++;
      const arr = [];
      skip();
      if (src[i] === ']') { i++; return arr; }
      for (;;) {
        arr.push(parseValue());
        skip();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return arr; }
        return null;
      }
    }
    if (c === '{') {
      // Object literal {k: v, "k2": v} — dipakai NT (rival.notes). Kunci boleh
      // telanjang (f, to, a, ...) atau string. (Cermin lib/studio.ts.)
      i++;
      const obj = {};
      skip();
      if (src[i] === '}') { i++; return obj; }
      for (;;) {
        skip();
        let key;
        if (src[i] === "'" || src[i] === '"') key = parseString();
        else {
          const km = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
          if (!km) return null;
          key = km[0];
          i += key.length;
        }
        skip();
        if (src[i] !== ':') return null;
        i++;
        obj[key] = parseValue();
        skip();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return obj; }
        return null;
      }
    }
    if (c === "'" || c === '"') return parseString();
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    for (const [lit, val] of [['true', true], ['false', false], ['null', null]]) {
      if (src.startsWith(lit, i)) { i += lit.length; return val; }
    }
    return null;
  };
  const v = parseValue();
  if (v === null || v === undefined) return null;
  skip();
  return v;
}

const capsToJs = (caps) => '[' + caps.map((c) => '[' + numFmt(c[0]) + ',' + numFmt(c[1]) + ',' + JSON.stringify(c[2]) + (c.length > 3 && c[3] !== undefined ? ',' + c[3] : '') + ']').join(',') + ']';
const shotsToJs = (shots) => '[' + shots.map((s) => '[' + numFmt(s[0]) + ',[' + s[1].map(numFmt).join(',') + '],[' + s[2].map(numFmt).join(',') + ']' + ']').join(',') + ']';
const voToJs = (vo) => '[' + vo.map((v) => JSON.stringify(v)).join(',') + ']';

function replaceArray(html, name, serialized) {
  const span = findArraySpan(html, name);
  if (!span) return { html, ok: false };
  return { html: html.slice(0, span.start) + serialized + html.slice(span.end), ok: true };
}

export function parseCaps(html) {
  const span = findArraySpan(html, 'caps');
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const row of v) {
    if (!Array.isArray(row) || (row.length !== 3 && row.length !== 4)) return null;
    if (!isNum(row[0]) || !isNum(row[1]) || typeof row[2] !== 'string') return null;
    if (row.length === 4 && !isNum(row[3])) return null;
    out.push(row.length === 4 ? [row[0], row[1], row[2], row[3]] : [row[0], row[1], row[2]]);
  }
  return out;
}

export function parseShots(html) {
  const span = findArraySpan(html, 'shots');
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== 3) return null;
    if (!isNum(row[0]) || !Array.isArray(row[1]) || !Array.isArray(row[2])) return null;
    if (row[1].length !== 3 || row[2].length !== 3) return null;
    if (!row[1].every(isNum) || !row[2].every(isNum)) return null;
    out.push([row[0], [...row[1]], [...row[2]]]);
  }
  return out;
}

export function voKind(html) {
  const m = /\bVO\s*=/.exec(html);
  if (!m) return 'none';
  let i = m.index + m[0].length;
  while (i < html.length && /[ \t]/.test(html[i])) i++;
  if (html[i] === '[') return 'literal';
  if (html.startsWith('caps.map', i)) return 'derived';
  return 'none';
}

export function parseVO(html) {
  if (voKind(html) !== 'literal') return null;
  const span = findArraySpan(html, 'VO');
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return null;
  return [...v];
}

export function setCaps(html, caps) { return replaceArray(html, 'caps', capsToJs(caps)); }
export function setShots(html, shots) { return replaceArray(html, 'shots', shotsToJs(shots)); }

export function setVO(html, vo) {
  const kind = voKind(html);
  if (kind === 'literal') return replaceArray(html, 'VO', voToJs(vo));
  if (kind === 'derived') {
    const m = /\bVO\s*=/.exec(html);
    if (!m) return { html, ok: false };
    let i = m.index + m[0].length;
    while (i < html.length && /[ \t]/.test(html[i])) i++;
    let depth = 0, instr = null, esc = false, j = i;
    for (; j < html.length; j++) {
      const c = html[j];
      if (instr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === instr) instr = null; continue; }
      if (c === "'" || c === '"') instr = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if ((c === ',' || c === ';') && depth === 0) break;
    }
    return { html: html.slice(0, i) + voToJs(vo) + html.slice(j), ok: true };
  }
  return { html, ok: false };
}

// ---------- setText (mirror lib/studio.ts; + nl() khusus CLI) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toHtml = (v) => esc(v).replace(/\n/g, '<br>');
const nl = (s) => String(s).replace(/\\n/g, '\n'); // CLI menulis newline sebagai \n
export function setText(html, f) {
  let h = html;
  if (f.title !== undefined) {
    h = h.replace(/(<div id="title">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (m, a, b, c) => a + toHtml(nl(f.title)) + c);
  }
  if (f.sub !== undefined) {
    h = h.replace(/(<div id="title">[\s\S]*?<small\b[^>]*>)([\s\S]*?)(<\/small><\/div>)/,
      (m, a, b, c) => a + esc(nl(f.sub)) + c);
  }
  if (f.end !== undefined) {
    h = h.replace(/(<div id="end">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<b class="cr">[\s\S]*?<\/b>)?(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (m, a, b, cr, c) => a + toHtml(nl(f.end)) + (cr || '') + c);
  }
  return h;
}

// ---------- props (mirror lib/studio.ts PROP_DEFS) ----------
const MULTI = ['template.html', 'template-code.html', 'template-kuota.html', 'template-rival.html', 'template-trio.html', 'template-perang.html'];
const SINGLE = ['template-typing.html', 'template-deploy.html', 'template-bughunter.html', 'template-bomb.html', 'template-meeting.html', 'template-sleep.html'];
const WITH_MON = ['template.html', 'template-code.html', 'template-kuota.html', 'template-rival.html', 'template-trio.html'];
const WITH_MUG = ['template-typing.html', 'template-deploy.html', 'template-bughunter.html', 'template-bomb.html', 'template-sleep.html'];

export const PROP_DEFS = [
  { id: 'claude.x', label: 'Claude · posisi X', group: 'Maskot', kind: 'number', min: -3, max: 3, step: 0.05, files: MULTI, unavailableReason: 'Template ini hanya punya satu maskot; posisinya dihitung animasi frame() (sway/turn), bukan nilai literal.', anchor: { t: 'array', name: 'X', index: 0 }, anchorByFile: { 'template-perang.html': { t: 'array', name: 'gx', index: 0 } } },
  { id: 'codex.x', label: 'Codex · posisi X', group: 'Maskot', kind: 'number', min: -3, max: 3, step: 0.05, files: MULTI, unavailableReason: 'Template ini hanya punya satu maskot (Claude).', anchor: { t: 'array', name: 'X', index: 1 }, anchorByFile: { 'template-perang.html': { t: 'array', name: 'gx', index: 1 } } },
  { id: 'gemini.x', label: 'Gemini · posisi X', group: 'Maskot', kind: 'number', min: -3, max: 3, step: 0.05, files: ['template-trio.html'], unavailableReason: 'Hanya template-trio yang punya maskot ketiga (Gemini).', anchor: { t: 'array', name: 'X', index: 2 } },
  { id: 'claude.scale', label: 'Claude · skala', group: 'Maskot', kind: 'number', min: 0.5, max: 1.3, step: 0.05, files: ['template-perang.html'], unavailableReason: 'Hanya template-perang yang punya literal skala Claude (gs[0]); di template lain skala Claude = 1 implisit (tidak ada literalnya).', anchor: { t: 'array', name: 'gs', index: 0 } },
  { id: 'codex.scale', label: 'Codex · skala', group: 'Maskot', kind: 'number', min: 0.5, max: 1.3, step: 0.05, files: MULTI, unavailableReason: 'Template ini hanya punya satu maskot; maskot tunggal tidak punya skala literal.', anchor: { t: 'call', prefix: 'dm.scale.setScalar(', index: 0 }, anchorByFile: { 'template-perang.html': { t: 'array', name: 'gs', index: 1 } } },
  { id: 'gemini.scale', label: 'Gemini · skala', group: 'Maskot', kind: 'number', min: 0.5, max: 1.3, step: 0.05, files: ['template-trio.html'], unavailableReason: 'Hanya template-trio yang punya maskot ketiga (Gemini).', anchor: { t: 'call', prefix: 'gm.scale.setScalar(', index: 0 } },
  { id: 'claude.color', label: 'Claude · warna aksen', group: 'Warna', kind: 'color', files: [...MULTI, ...SINGLE], unavailableReason: '', anchor: { t: 'hex', prefix: 'OR=M(0x' } },
  { id: 'codex.color', label: 'Codex · warna aksen', group: 'Warna', kind: 'color', files: MULTI, unavailableReason: 'Template ini hanya punya satu maskot (Claude).', anchor: { t: 'hex', prefix: 'VI=M(0x' } },
  { id: 'gemini.color', label: 'Gemini · warna aksen', group: 'Warna', kind: 'color', files: ['template-trio.html'], unavailableReason: 'Hanya template-trio yang punya maskot ketiga (Gemini).', anchor: { t: 'hex', prefix: 'lg=new THREE.SpotLight(0x' } },
  { id: 'board.y', label: 'Papan skor · tinggi (Y)', group: 'Layar & Set', kind: 'number', min: 2.5, max: 6.5, step: 0.1, files: MULTI, unavailableReason: 'Template ini tidak punya papan skor.', anchor: { t: 'call', prefix: 'board.position.set(', index: 1 } },
  { id: 'monitor.claude.x', label: 'Monitor Claude · posisi X', group: 'Layar & Set', kind: 'number', min: -3, max: 3, step: 0.05, files: WITH_MON, unavailableReason: 'Template ini tidak punya monitor ganda (mkMon); layarnya satu panel scr.', anchor: { t: 'mkmon', index: 0 } },
  { id: 'monitor.codex.x', label: 'Monitor Codex · posisi X', group: 'Layar & Set', kind: 'number', min: -3, max: 3, step: 0.05, files: WITH_MON, unavailableReason: 'Template ini tidak punya monitor ganda (mkMon).', anchor: { t: 'mkmon', index: 1 } },
  { id: 'monitor.gemini.x', label: 'Monitor Gemini · posisi X', group: 'Layar & Set', kind: 'number', min: -3, max: 3, step: 0.05, files: ['template-trio.html'], unavailableReason: 'Hanya template-trio yang punya monitor ketiga.', anchor: { t: 'mkmon', index: 2 } },
  { id: 'screen.x', label: 'Layar · posisi X', group: 'Layar & Set', kind: 'number', min: -2, max: 2, step: 0.05, files: SINGLE, unavailableReason: 'Template multi-maskot memakai monitor mkMon + papan skor, bukan satu panel scr.', anchor: { t: 'call', prefix: 'scr.position.set(', index: 0 } },
  { id: 'screen.y', label: 'Layar · tinggi (Y)', group: 'Layar & Set', kind: 'number', min: 1, max: 3, step: 0.05, files: SINGLE, unavailableReason: 'Template multi-maskot memakai monitor mkMon + papan skor, bukan satu panel scr.', anchor: { t: 'call', prefix: 'scr.position.set(', index: 1 } },
  { id: 'mug.x', label: 'Mug · posisi X', group: 'Layar & Set', kind: 'number', min: -3, max: 3, step: 0.05, files: WITH_MUG, unavailableReason: 'Template-meeting tidak punya mug di set-nya; template multi-maskot memakai set panggung berbeda.', anchor: { t: 'call', prefix: 'mug.position.set(', index: 0 } },
  { id: 'window.x', label: 'Jendela · posisi X', group: 'Layar & Set', kind: 'number', min: -4, max: 0, step: 0.05, files: SINGLE, unavailableReason: 'Template multi-maskot memakai set panggung berbeda (dinding + papan skor).', anchor: { t: 'call', prefix: 'win.position.set(', index: 0 } },
  { id: 'lamp.x', label: 'Lampu · posisi X', group: 'Layar & Set', kind: 'number', min: -5, max: 5, step: 0.05, files: SINGLE, unavailableReason: 'Template multi-maskot memakai lampu sorot per maskot, bukan satu lampu.', anchor: { t: 'call', prefix: 'lamp.position.set(', index: 0 } },
  // ---- Def array (cermin lib/studio.ts PROP_DEFS — keduanya harus tetap sinkron) ----
  // Skor papan template-code: CL0/CL1/CX0/CX1 = [KEBERSIHAN, TES LULUS, PERFORMA].
  { id: 'board.claude.start', label: 'Papan · skor awal Claude [3]', group: 'Papan skor', kind: 'array', files: ['template-code.html'], unavailableReason: 'Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1; template lain skornya dihitung (sinus / envelope / REM) atau tidak punya papan.', anchor: { t: 'whole', name: 'CL0' }, validate: (v) => boardScoreErr(v, 'board.claude.start') },
  { id: 'board.claude.final', label: 'Papan · skor akhir Claude [3]', group: 'Papan skor', kind: 'array', files: ['template-code.html'], unavailableReason: 'Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.', anchor: { t: 'whole', name: 'CL1' }, validate: (v) => boardScoreErr(v, 'board.claude.final') },
  { id: 'board.codex.start', label: 'Papan · skor awal Codex [3]', group: 'Papan skor', kind: 'array', files: ['template-code.html'], unavailableReason: 'Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.', anchor: { t: 'whole', name: 'CX0' }, validate: (v) => boardScoreErr(v, 'board.codex.start') },
  { id: 'board.codex.final', label: 'Papan · skor akhir Codex [3]', group: 'Papan skor', kind: 'array', files: ['template-code.html'], unavailableReason: 'Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.', anchor: { t: 'whole', name: 'CX1' }, validate: (v) => boardScoreErr(v, 'board.codex.final') },
  // Kurva tangki token kuota: keyframe [detik, persen] — ada reset (naik lagi ke 100).
  { id: 'tank.curve', label: 'Tangki token · kurva [detik, %]', group: 'Papan skor', kind: 'array', files: ['template-kuota.html'], unavailableReason: 'Hanya template-kuota yang punya tangki token (RK).', anchor: { t: 'whole', name: 'RK' }, validate: (v, ctx) => tankCurveErr(v, ctx) },
  // Sticky notes rival: NT = [{f,to,a,b,o,r,tx}] (f 0=Claude/1=Codex, a/b jendela
  // terbang, o waktu sobek — 99 = tidak pernah sobek, tx 1-2 baris).
  { id: 'rival.notes', label: 'Rival · sticky notes', group: 'Layar & Set', kind: 'array', files: ['template-rival.html'], unavailableReason: 'Hanya template-rival yang punya sticky notes terbang (NT).', anchor: { t: 'whole', name: 'NT' }, validate: (v, ctx) => rivalNotesErr(v, ctx) },
  // Perang: SP = [[waktu spawn Claude...],[waktu spawn Codex...]]; EV = baris
  // [pihak, mulai, ...] ketapel koin.
  { id: 'war.spawns', label: 'Perang · waktu spawn sub agent', group: 'Perang', kind: 'array', files: ['template-perang.html'], unavailableReason: 'Hanya template-perang yang punya pasukan sub agent (SP).', anchor: { t: 'whole', name: 'SP' }, validate: (v, ctx) => warSpawnsErr(v, ctx) },
  { id: 'war.catapults', label: 'Perang · tembakan ketapel koin', group: 'Perang', kind: 'array', files: ['template-perang.html'], unavailableReason: 'Hanya template-perang yang punya ketapel koin (EV).', anchor: { t: 'whole', name: 'EV' }, validate: (v, ctx) => warCatapultsErr(v, ctx) },
  // Jendela ketik + teks ketikan (bughunter/bomb/meeting): WIN dan TL harus
  // konsisten (jumlah baris sama; tiap jendela cukup untuk teksnya).
  { id: 'typing.windows', label: 'Ketik · jendela [[mulai, selesai]]', group: 'Ketik', kind: 'array', files: ['template-bughunter.html', 'template-bomb.html', 'template-meeting.html'], unavailableReason: 'Template ini tidak punya jendela ketik WIN (typing/deploy mengetik dari drawScr inline; factor template tidak mengetik).', anchor: { t: 'whole', name: 'WIN' }, validate: (v, ctx) => typingWindowsErr(v, ctx) },
  { id: 'typing.lines', label: 'Ketik · baris ketikan [[...]]', group: 'Ketik', kind: 'array', files: ['template-bughunter.html', 'template-bomb.html', 'template-meeting.html'], unavailableReason: 'Template ini tidak punya teks ketik TL.', anchor: { t: 'whole', name: 'TL' }, validate: (v, ctx) => typingLinesErr(v, ctx) },
  // Meeting: MEET_END=24.2 dipakai bersama timer + confetti + spin + layar.
  { id: 'meeting.end', label: 'Meeting · detik rapat selesai', group: 'Ketik', kind: 'number', min: 10, max: 32, step: 0.1, files: ['template-meeting.html'], unavailableReason: 'Hanya template-meeting yang punya konstanta MEET_END.', anchor: { t: 'assign', name: 'MEET_END' } },
];

// Validator nilai untuk def 'array' baru. Kembalikan string error atau null.
function boardScoreErr(v, id) {
  if (!Array.isArray(v) || v.length !== 3) return `${id}: harus array 3 angka [KEBERSIHAN, TES LULUS, PERFORMA].`;
  for (const n of v) if (!Number.isInteger(n) || n < 0 || n > 100) return `${id}: tiap skor harus bilangan bulat 0..100 (dapat ${JSON.stringify(v)}).`;
  return null;
}
function tankCurveErr(v, ctx) {
  if (!Array.isArray(v) || v.length < 2) return 'tank.curve: harus array keyframe [[detik, persen], ...] minimal 2 baris.';
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 2 || !isNum(r[0]) || !isNum(r[1])) return `tank.curve[${i}]: harus [detik, persen].`;
    if (r[0] < 0) return `tank.curve[${i}]: detik ${r[0]} < 0.`;
    if (r[0] <= prev) return `tank.curve[${i}]: detik harus terurut naik ketat.`;
    if (r[1] < 0 || r[1] > 100) return `tank.curve[${i}]: persen ${r[1]} di luar 0..100.`;
    if (i === 0 && r[0] !== 0) return 'tank.curve: keyframe pertama harus detik 0 (tangki mulai penuh).';
    prev = r[0];
  }
  return null;
}
function rivalNotesErr(v, ctx) {
  if (!Array.isArray(v)) return 'rival.notes: harus array [{f,to,a,b,o,r,tx}, ...].';
  let prevA = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const n = v[i];
    if (!n || typeof n !== 'object') return `rival.notes[${i}]: harus object {f,to,a,b,o,r,tx}.`;
    if (n.f !== 0 && n.f !== 1) return `rival.notes[${i}]: f harus 0 (Claude) atau 1 (Codex).`;
    if (!Array.isArray(n.to) || n.to.length !== 2 || !n.to.every(isNum)) return `rival.notes[${i}]: to harus [x, y] angka (posisi di monitor).`;
    if (!isNum(n.a) || !isNum(n.b) || !(0 <= n.a && n.a < n.b && n.b <= ctx.len)) return `rival.notes[${i}]: harus 0 <= a < b <= LEN (${ctx.len}).`;
    if (n.a < prevA) return `rival.notes[${i}]: a harus terurut naik.`;
    if (!isNum(n.o) || !(n.o === 99 || n.o >= n.b)) return `rival.notes[${i}]: o harus >= b, atau 99 (= tidak pernah sobek).`;
    if (!isNum(n.r)) return `rival.notes[${i}]: r harus angka (rotasi).`;
    if (!Array.isArray(n.tx) || n.tx.length < 1 || n.tx.length > 2 || !n.tx.every((s) => typeof s === 'string' && s.length >= 1 && s.length <= 14)) return `rival.notes[${i}]: tx harus 1-2 string, tiap baris 1..14 karakter.`;
    prevA = n.a;
  }
  return null;
}
function warSpawnsErr(v, ctx) {
  if (!Array.isArray(v) || v.length !== 2) return 'war.spawns: harus [[waktu...],[waktu...]] (satu array per pihak).';
  for (let s = 0; s < 2; s++) {
    const row = v[s];
    if (!Array.isArray(row) || row.length < 1 || row.length > 8) return `war.spawns[${s}]: harus 1..8 waktu spawn.`;
    let prev = -Infinity;
    for (const t of row) {
      if (!isNum(t) || t < 0 || t > ctx.len) return `war.spawns[${s}]: waktu ${t} di luar 0..LEN (${ctx.len}).`;
      if (t <= prev) return `war.spawns[${s}]: waktu harus terurut naik ketat.`;
      prev = t;
    }
  }
  return null;
}
function warCatapultsErr(v, ctx) {
  if (!Array.isArray(v)) return 'war.catapults: harus array baris [pihak, mulai, ...] (6 angka).';
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 6 || !r.every(isNum)) return `war.catapults[${i}]: harus 6 angka [pihak, mulai, ...].`;
    if (r[0] !== 0 && r[0] !== 1) return `war.catapults[${i}]: pihak harus 0 (Claude) atau 1 (Codex).`;
    if (r[1] < 0 || r[1] > ctx.len) return `war.catapults[${i}]: mulai ${r[1]} di luar 0..LEN (${ctx.len}).`;
    if (r[1] <= prev) return `war.catapults[${i}]: mulai harus terurut naik ketat.`;
    prev = r[1];
  }
  return null;
}
function typingWindowsErr(v, ctx) {
  if (!Array.isArray(v) || v.length === 0) return 'typing.windows: harus array [[mulai, selesai], ...] tak kosong.';
  let prevEnd = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const w = v[i];
    if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `typing.windows[${i}]: harus [mulai, selesai].`;
    if (!(0 <= w[0] && w[0] < w[1] && w[1] <= ctx.len)) return `typing.windows[${i}]: harus 0 <= mulai < selesai <= LEN (${ctx.len}).`;
    if (w[0] < prevEnd) return `typing.windows[${i}]: tumpang tindih dengan jendela sebelumnya (jendela ketik harus disjoint).`;
    prevEnd = w[1];
  }
  return null;
}
function typingLinesErr(v, ctx) {
  if (!Array.isArray(v) || v.length === 0) return 'typing.lines: harus array baris ketikan [[...], ...] tak kosong.';
  for (let i = 0; i < v.length; i++) {
    const row = v[i];
    if (!Array.isArray(row) || row.length < 1 || row.length > 4) return `typing.lines[${i}]: harus 1..4 string per jendela.`;
    for (const s of row) {
      if (typeof s !== 'string' || !s.length || s.length > 200) return `typing.lines[${i}]: tiap baris harus string 1..200 karakter.`;
    }
  }
  return null;
}

const anchorFor = (def, file) => (def.anchorByFile && def.anchorByFile[file]) || def.anchor;

export function readProp(html, def, file) {
  const a = anchorFor(def, file);
  if (a.t === 'array') {
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    if (!Array.isArray(v)) return null;
    const el = v[a.index];
    return typeof el === 'number' ? el : typeof el === 'string' ? el : null;
  }
  if (a.t === 'call') {
    const at = html.indexOf(a.prefix);
    if (at < 0) return null;
    const inner = html.slice(at + a.prefix.length);
    const m = /^[^)]*/.exec(inner);
    if (!m) return null;
    const parts = m[0].split(',').map((s) => parseFloat(s));
    const v = parts[a.index];
    return Number.isFinite(v) ? v : null;
  }
  if (a.t === 'hex') {
    const at = html.indexOf(a.prefix);
    if (at < 0) return null;
    const hex = html.slice(at + a.prefix.length, at + a.prefix.length + 6);
    return /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex.toLowerCase() : null;
  }
  if (a.t === 'whole') {
    // Seluruh array (RK/EV/SP/NT/WIN/TL/CL0/...): kembalikan nilai ter-parse.
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    return Array.isArray(v) ? v : null;
  }
  if (a.t === 'assign') {
    // Satu angka `NAME=...` (MEET_END).
    const re = new RegExp('\\b' + a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*(-?[\\d.]+)');
    const m = re.exec(html);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return Number.isFinite(v) ? v : null;
  }
  const re = /mkMon\((-?[\d.]+),\(g/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) found.push(parseFloat(m[1]));
  const v = found[a.index];
  return v !== undefined && Number.isFinite(v) ? v : null;
}

export function parseProps(html, file) {
  return PROP_DEFS.map((def) => {
    if (!def.files.includes(file)) return { def, available: false, reason: def.unavailableReason };
    const v = readProp(html, def, file);
    if (v === null) return { def, available: false, reason: 'Pola literal tidak ditemukan di template ini.' };
    return { def, available: true, value: v };
  });
}

export function setProp(html, def, file, value) {
  const a = anchorFor(def, file);
  if (a.t === 'array') {
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    const v = parseJsArray(html.slice(span.start, span.end));
    if (!Array.isArray(v)) return { html, ok: false };
    const next = [...v];
    next[a.index] = typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;
    const ser = '[' + next.map((x) => (typeof x === 'string' ? JSON.stringify(x) : numFmt(x))).join(',') + ']';
    return { html: html.slice(0, span.start) + ser + html.slice(span.end), ok: true };
  }
  if (a.t === 'call') {
    const at = html.indexOf(a.prefix);
    if (at < 0) return { html, ok: false };
    const start = at + a.prefix.length;
    const close = html.indexOf(')', start);
    if (close < 0) return { html, ok: false };
    const parts = html.slice(start, close).split(',');
    if (a.index >= parts.length) return { html, ok: false };
    parts[a.index] = typeof value === 'number' ? numFmt(value) : String(value);
    return { html: html.slice(0, start) + parts.join(',') + html.slice(close), ok: true };
  }
  if (a.t === 'hex') {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return { html, ok: false };
    const at = html.indexOf(a.prefix);
    if (at < 0) return { html, ok: false };
    const hex = value.slice(1).toLowerCase();
    return { html: html.slice(0, at + a.prefix.length) + hex + html.slice(at + a.prefix.length + 6), ok: true };
  }
  if (a.t === 'whole') {
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    return { html: html.slice(0, span.start) + JSON.stringify(value) + html.slice(span.end), ok: true };
  }
  if (a.t === 'assign') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return { html, ok: false };
    const re = new RegExp('(\\b' + a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*)(-?[\\d.]+)');
    if (!re.test(html)) return { html, ok: false };
    return { html: html.replace(re, (_m, p) => p + numFmt(value)), ok: true };
  }
  const re = /mkMon\((-?[\d.]+),\(g/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) found.push({ start: m.index + 'mkMon('.length, end: m.index + 'mkMon('.length + m[1].length });
  const hit = found[a.index];
  if (!hit || typeof value !== 'number') return { html, ok: false };
  return { html: html.slice(0, hit.start) + numFmt(value) + html.slice(hit.end), ok: true };
}

export function setProps(html, file, propsIn) {
  const props = normalizeProps(propsIn);
  let h = html;
  const failed = [];
  for (const def of PROP_DEFS) {
    if (!(def.id in props)) continue;
    const r = setProp(h, def, file, props[def.id]);
    if (!r.ok) { failed.push(def.id); continue; }
    h = r.html;
  }
  const ccSync = { 'claude.color': 0, 'codex.color': 1, 'gemini.color': 2 };
  for (const [id, idx] of Object.entries(ccSync)) {
    if (!(id in props) || typeof props[id] !== 'string') continue;
    const span = findArraySpan(h, 'CC');
    if (!span) continue;
    const v = parseJsArray(h.slice(span.start, span.end));
    if (!Array.isArray(v) || idx >= v.length) continue;
    const next = [...v];
    next[idx] = props[id];
    h = h.slice(0, span.start) + '[' + next.map((x) => JSON.stringify(x)).join(',') + ']' + h.slice(span.end);
  }
  return { html: h, ok: failed.length === 0, failed };
}

// ---------- validasi (mirror lib/studio.ts) ----------
const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;

export function validateCaps(caps, len) {
  const errors = [], warnings = [];
  caps.forEach((c, i) => {
    const n = i + 1;
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) { errors.push(`Caption #${n}: waktu mulai/selesai bukan angka.`); return; }
    if (c[0] < 0) errors.push(`Caption #${n}: mulai ${c[0]}s < 0.`);
    if (c[1] > len) errors.push(`Caption #${n}: selesai ${c[1]}s melebihi durasi ${len}s.`);
    if (!(c[1] > c[0])) errors.push(`Caption #${n}: selesai harus sesudah mulai.`);
    if (!c[2] || !c[2].trim()) errors.push(`Caption #${n}: teks kosong.`);
    if (c.length > 3 && c[3] !== undefined && (!Number.isInteger(c[3]) || c[3] < 0 || c[3] > 2)) errors.push(`Caption #${n}: speaker harus 0, 1, atau 2.`);
    const dur = c[1] - c[0];
    if (dur > 0 && c[2]) {
      const wps = wordCount(c[2]) / dur;
      if (wps > 2.5) warnings.push(`Caption #${n}: ${wps.toFixed(1)} kata/detik — di atas 2.5, penonton sulit membaca.`);
    }
    if (i > 0) {
      if (c[0] < caps[i - 1][0]) errors.push(`Caption #${n}: tidak terurut (mulai sebelum caption #${i}).`);
      if (c[0] < caps[i - 1][1]) errors.push(`Caption #${n}: tumpang tindih dengan caption #${i}.`);
    }
  });
  return { errors, warnings };
}

export function validateShots(shots, len) {
  const errors = [], warnings = [];
  shots.forEach((s, i) => {
    const n = i + 1;
    if (!Number.isFinite(s[0])) { errors.push(`Shot #${n}: waktu mulai bukan angka.`); return; }
    if (s[0] < 0) errors.push(`Shot #${n}: mulai ${s[0]}s < 0.`);
    if (s[0] >= len) errors.push(`Shot #${n}: mulai ${s[0]}s >= durasi ${len}s.`);
    [['kamera', 1], ['lookAt', 2]].forEach(([what, k]) => {
      const v = s[k];
      if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) errors.push(`Shot #${n}: ${what} harus 3 angka.`);
    });
    if (i > 0 && s[0] <= shots[i - 1][0]) errors.push(`Shot #${n}: tidak terurut (mulai <= shot #${i}).`);
    const end = i + 1 < shots.length ? shots[i + 1][0] : len;
    if (end - s[0] < 0.5) warnings.push(`Shot #${n}: hanya ${(end - s[0]).toFixed(1)} dtk — potongan sangat cepat.`);
  });
  return { errors, warnings };
}

export function validateProps(propsIn, file, len = 0) {
  const props = normalizeProps(propsIn);
  const errors = [], warnings = [];
  const xs = [];
  for (const id of ['claude.x', 'codex.x', 'gemini.x']) {
    const v = props[id];
    if (typeof v === 'number') {
      xs.push({ id, v });
      if (Math.abs(v) > 3.2) errors.push(`${id}: |${v}| > 3.2 — maskot keluar frame.`);
      else if (Math.abs(v) > 2.9) warnings.push(`${id}: ${v} dekat tepi frame.`);
    }
  }
  xs.sort((a, b) => a.v - b.v);
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i].v - xs[i - 1].v;
    if (gap <= 0.1) errors.push(`${xs[i - 1].id} dan ${xs[i].id}: jarak ${gap.toFixed(2)} — maskot bertabrakan (butuh >0.1).`);
    else if (gap < 2.6) warnings.push(`${xs[i - 1].id} dan ${xs[i].id}: jarak ${gap.toFixed(2)} < 2.6 — monitor 2.4 bisa tumpang tindih (SKILL.md).`);
  }
  for (const def of PROP_DEFS) {
    if (!(def.id in props)) continue;
    const v = props[def.id];
    if (def.kind === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${def.id}: harus angka.`); continue; }
      if (def.min !== undefined && v < def.min) errors.push(`${def.id}: ${v} < batas ${def.min}.`);
      if (def.max !== undefined && v > def.max) errors.push(`${def.id}: ${v} > batas ${def.max}.`);
    } else if (def.kind === 'color') {
      if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`${def.id}: warna harus format #rrggbb.`);
    }
    // kind 'array' (whole): divalidasi def.validate di bawah, bukan di sini.
    if (typeof def.validate === 'function') {
      const e = def.validate(v, { len });
      if (e) errors.push(e);
    }
  }
  for (const [mon, mas] of [['monitor.claude.x', 'claude.x'], ['monitor.codex.x', 'codex.x'], ['monitor.gemini.x', 'gemini.x']]) {
    const a = props[mon], b = props[mas];
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) > 0.8)
      warnings.push(`${mon} (${a}) jauh dari ${mas} (${b}) — monitor dan maskot tidak sejajar.`);
  }
  return { errors, warnings };
}

// ---------- applyEdits ----------
export function applyEdits(html, spec, len) {
  let h = html;
  const applied = [], failed = [];
  let voFollowedCaps = false;
  const text = {};
  if (spec.title !== undefined) text.title = spec.title;
  if (spec.sub !== undefined) text.sub = spec.sub;
  if (spec.end !== undefined) text.end = spec.end;
  if (Object.keys(text).length) { h = setText(h, text); applied.push('text'); }
  if (spec.caps) {
    const r = setCaps(h, spec.caps);
    h = r.html;
    if (r.ok) applied.push('caps'); else failed.push('caps');
  }
  if (spec.shots) {
    const r = setShots(h, spec.shots);
    h = r.html;
    if (r.ok) applied.push('shots'); else failed.push('shots');
  }
  if (spec.vo) {
    const r = setVO(h, spec.vo);
    h = r.html;
    if (r.ok) applied.push('vo'); else failed.push('vo');
  } else if (spec.caps) {
    const kind = voKind(h);
    if (kind === 'literal') {
      const r = setVO(h, spec.caps.map((c) => c[2]));
      h = r.html;
      if (r.ok) { applied.push('vo'); voFollowedCaps = true; } else failed.push('vo');
    } else if (kind === 'derived') {
      voFollowedCaps = true;
    }
  }
  if (spec.props && Object.keys(normalizeProps(spec.props)).length) {
    const props = normalizeProps(spec.props);
    const r = setProps(h, spec.file, props);
    h = r.html;
    if (r.ok) applied.push('props'); else failed.push(...r.failed.map((id) => 'props:' + id));
  }
  return { html: h, ok: failed.length === 0, applied, failed, voFollowedCaps };
}

// ---------- CLI ----------
const fail = (msg) => { console.error(`apply-edit: error: ${msg}`); process.exit(1); };
const warn = (msg) => console.warn(`apply-edit: peringatan: ${msg}`);
const note = (msg) => console.log(`apply-edit: ${msg}`);

const HELP = `apply-edit.mjs — terapkan spec edit JSON ke satu template threejs-cinematic-short.

Penggunaan:
  node scripts/apply-edit.mjs --file <template.html> --edit <spec.json> --out <out.html>
  node scripts/apply-edit.mjs --file <template.html> --title 'J' --sub 'S' --end 'E' --out <out.html>
  node scripts/apply-edit.mjs --list-props <template.html>

Flag:
  --file <nama|path>   template sumber (nama saja = public/templates/<nama>)
  --edit <spec.json>   spec edit JSON format kanonik (lihat header file ini)
  --out <path>         file hasil (default: <nama-template>.edited.html di cwd;
                       TIDAK BOLEH di dalam public/templates/ atau sama dengan input)
  --title/--sub/--end  jalan pintas teks (menimpa field yang sama di spec bila ada;
                       tulis newline sebagai \\n, seperti scripts/export.mjs)
  --list-props <file>  daftar props yang bisa diedit di template itu + nilai saat ini
  --help               tampilkan bantuan ini

Aturan keras: validasi gagal / pola tidak ditemukan = exit non-zero dan TIDAK
ada output yang ditulis. VO mengikuti caps bila "vo" tidak diisi (lihat header).`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const k = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const v = eq >= 0 ? a.slice(eq + 1) : argv[++i];
      if (v === undefined) fail(`flag --${k} butuh nilai`);
      args[k] = v;
    } else fail(`argumen tidak dikenal: ${a} (lihat --help)`);
  }
  return args;
}

function resolveTemplate(file) {
  if (existsSync(file)) return resolve(file);
  const under = join(TPL_DIR, file);
  if (existsSync(under)) return under;
  fail(`template tidak ditemukan: ${file} (dicari sebagai path dan di public/templates/)`);
}

function readLEN(html, file) {
  // (?<![\w$])LEN — jangan sampai menangkap SIP_LEN (meeting) atau sejenisnya.
  const m = html.match(/(?:^|[^\w$])LEN\s*=\s*([\d.]+)/);
  if (!m) fail(`LEN tidak ditemukan di ${file}`);
  return parseFloat(m[1]);
}

/** Normalisasi spec.props: array [{id,value}] (alias lama) atau object
 *  {id: value} (kanonik). Keduanya dinormalisasi ke map id -> nilai.
 *  Throw pada bentuk tidak valid (pemanggil CLI mengubahnya jadi fail).
 *  Cermin normalizeProps() di lib/studio.ts. */
export function normalizeProps(raw) {
  if (raw === undefined) return {};
  if (Array.isArray(raw)) {
    const out = {};
    for (const p of raw) {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !('value' in p))
        throw new Error(`props array: tiap entri harus {"id":"...","value":...} (dapat ${JSON.stringify(p)})`);
      if (p.id in out) throw new Error(`props array: id "${p.id}" muncul dua kali`);
      out[p.id] = p.value;
    }
    return out;
  }
  if (raw && typeof raw === 'object') return { ...raw };
  throw new Error('props harus array [{"id","value"}] atau object {"id": value}');
}

function countCredit(html) {
  return (html.match(/@hanzvibes/g) || []).length;
}

/** Cek `node --check` pada SEMUA blok <script> inline hasil edit. */
function syntaxCheckAll(html) {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) fail('tidak ada blok <script> inline di hasil edit (template rusak?)');
  const dir = mkdtempSync(join(tmpdir(), 'apply-edit-'));
  try {
    blocks.forEach((b, i) => {
      const p = join(dir, `script${i}.js`);
      writeFileSync(p, b);
      try {
        execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
      } catch (e) {
        fail(`node --check gagal pada <script> inline ke-${i + 1} hasil edit: ${String((e.stderr || e.message || e)).slice(0, 400)}`);
      }
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readMascotX(html) {
  for (const name of ['X', 'gx']) {
    const span = findArraySpan(html, name);
    if (!span) continue;
    const v = parseJsArray(html.slice(span.start, span.end));
    if (Array.isArray(v) && v.length >= 2 && v.every(isNum) && v.every((x) => Math.abs(x) <= 3.5)) return v;
  }
  return null;
}

function readMonitorX(html) {
  const re = /mkMon\((-?[\d.]+),\(g/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) found.push(parseFloat(m[1]));
  return found;
}

/** Validasi silang pada HTML AKHIR (nilai gabungan spec + template). */
function crossCheckFinal(html, file, touched, LEN) {
  const errors = [], warnings = [];
  const mascotTouched = ['claude.x', 'codex.x', 'gemini.x'].some((id) => touched.has(id));
  if (mascotTouched) {
    const X = readMascotX(html);
    if (!X) warnings.push('posisi maskot tidak terbaca di HTML akhir — lewati cek gap/framing.');
    else {
      const sorted = [...X].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        if (gap <= 0.1) errors.push(`gap maskot ${gap.toFixed(2)} — maskot bertabrakan (butuh >0.1).`);
        else if (gap < MIN_MASCOT_GAP) errors.push(`gap maskot ${gap.toFixed(2)} < ${MIN_MASCOT_GAP} — faktor argue/joy/typing menggeser tiap maskot ~1,2 unit ke tengah, lengan akan clipping di tengah adegan. Longgarkan posisi X.`);
      }
      const shots = parseShots(html);
      if (shots && shots.length) {
        const [t0, pos, look] = shots[0];
        const d = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
        const halfW = 0.4875 * d; // lebar tampak = 0.975 * jarak kamera (SKILL.md)
        for (const x of X) {
          if (Math.abs(x) + FRAME_MARGIN > halfW)
            errors.push(`framing shot 0: maskot di x=${x} keluar frame lebar (butuh |x|+${FRAME_MARGIN} <= ${halfW.toFixed(2)} pada jarak kamera ${d.toFixed(2)}). Geser mendekati tengah atau ubah shot 0.`);
        }
      }
    }
  }
  const monTouched = ['monitor.claude.x', 'monitor.codex.x', 'monitor.gemini.x'].some((id) => touched.has(id));
  if (monTouched) {
    const xs = readMonitorX(html).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] < MIN_MONITOR_GAP)
        errors.push(`gap monitor ${xs[i - 1]} dan ${xs[i]} < ${MIN_MONITOR_GAP} — bingkai monitor coplanar/tumpang tindih (SKILL.md).`);
    }
  }
  if (touched.has('typing.windows') || touched.has('typing.lines')) {
    const winSpan = findArraySpan(html, 'WIN');
    const tlSpan = findArraySpan(html, 'TL');
    if (!winSpan || !tlSpan) errors.push('WIN/TL tidak ditemukan di HTML akhir.');
    else {
      const WIN = parseJsArray(html.slice(winSpan.start, winSpan.end));
      const TL = parseJsArray(html.slice(tlSpan.start, tlSpan.end));
      if (!Array.isArray(WIN) || !Array.isArray(TL)) errors.push('WIN/TL gagal di-parse di HTML akhir.');
      else {
        if (WIN.length !== TL.length) errors.push(`typing: jumlah jendela WIN (${WIN.length}) != jumlah baris TL (${TL.length}) — tiap jendela butuh tepat satu baris ketikan.`);
        WIN.forEach((w, i) => {
          const row = TL[i];
          if (!row) return;
          const chars = row.reduce((a, s) => a + String(s).length, 0);
          const dur = w[1] - w[0];
          if (dur < chars / TYPE_CPS) errors.push(`typing jendela #${i + 1}: ${chars} huruf butuh ${(chars / TYPE_CPS).toFixed(1)} dtk pada ${TYPE_CPS} huruf/detik, jendela hanya ${dur.toFixed(1)} dtk — teks akan terpotong.`);
          else if (dur < chars / TYPE_CPS + 0.3) warnings.push(`typing jendela #${i + 1}: ${dur.toFixed(1)} dtk — mepet untuk ${chars} huruf (butuh ~${(chars / TYPE_CPS + 0.3).toFixed(1)} dtk).`);
        });
      }
    }
  }
  if (touched.has('meeting.end')) {
    const m = html.match(/\bMEET_END\s*=\s*([\d.]+)/);
    const winSpan = findArraySpan(html, 'WIN');
    if (m && winSpan) {
      const end = parseFloat(m[1]);
      const WIN = parseJsArray(html.slice(winSpan.start, winSpan.end));
      if (Array.isArray(WIN) && WIN.length) {
        const lastWin = Math.max(...WIN.map((w) => w[1]));
        if (end <= lastWin) errors.push(`meeting.end ${end} harus sesudah jendela ketik terakhir (${lastWin}) — timer/confetti/layar baca MEET_END yang sama.`);
      }
    }
  }
  return { errors, warnings };
}

function listProps(file) {
  const path = resolveTemplate(file);
  const html = readFileSync(path, 'utf8');
  // PROP_DEFS.files / anchorByFile memakai nama file telanjang
  // ('template-code.html'), jadi normalisasi dulu ke basename — kalau tidak,
  // parseProps() menganggap SEMUA props tidak tersedia (bug: argumen CLI
  // 'public/templates/template-code.html' tidak pernah cocok dengan
  // def.files.includes(file)). Jalur apply tidak kena bug ini karena sudah
  // memakai basename(srcPath) sebagai `base`.
  const base = basename(path);
  const LEN = readLEN(html, base);
  const caps = parseCaps(html);
  const shots = parseShots(html);
  const vk = voKind(html);
  console.log(`${file} · LEN=${LEN} · caps ${caps ? caps.length + ' (arity ' + (caps[0] ? caps[0].length : '?') + ')' : '?'} · shots ${shots ? shots.length : '?'} · VO ${vk}${vk === 'literal' ? ' (' + (parseVO(html) || []).length + ' baris)' : vk === 'derived' ? ' (caps.map)' : ''}`);
  console.log('props yang bisa diedit:');
  for (const p of parseProps(html, base)) {
    if (!p.available) continue;
    const range = p.def.kind === 'number' ? `angka ${p.def.min ?? '-'}..${p.def.max ?? '-'}` : p.def.kind === 'color' ? 'warna #rrggbb' : 'array (lihat validator di apply-edit.mjs)';
    let val = typeof p.value === 'string' ? p.value : JSON.stringify(p.value);
    if (val && val.length > 160) val = val.slice(0, 160) + '…';
    console.log(`  ${p.def.id} = ${val} — ${p.def.label} (${range})`);
  }
  console.log('props yang TIDAK tersedia di template ini:');
  let anyNo = false;
  for (const p of parseProps(html, base)) {
    if (p.available) continue;
    anyNo = true;
    console.log(`  ${p.def.id} — ${p.reason || p.def.unavailableReason || 'tidak ada di template ini'}`);
  }
  if (!anyNo) console.log('  (tidak ada)');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (args['list-props']) {
    listProps(args['list-props']);
    process.exit(0);
  }
  const file = args.file;
  if (!file) fail('butuh --file <template.html> (lihat --help)');
  const srcPath = resolveTemplate(file);
  const base = basename(srcPath);
  let spec = {};
  if (args.edit) {
    let raw;
    try {
      raw = await readFile(resolve(args.edit), 'utf8');
    } catch (e) {
      fail(`tidak bisa membaca spec ${args.edit}: ${e.message}`);
    }
    try {
      spec = JSON.parse(raw);
    } catch (e) {
      fail(`spec ${args.edit} bukan JSON valid: ${e.message}`);
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('spec harus object JSON {...}');
  }
  if (!args.edit && args.title === undefined && args.sub === undefined && args.end === undefined)
    fail('butuh --edit <spec.json> dan/atau --title/--sub/--end (lihat --help)');
  // Jalan pintas CLI menimpa field spec yang sama.
  if (args.title !== undefined) spec.title = nl(args.title);
  if (args.sub !== undefined) spec.sub = nl(args.sub);
  if (args.end !== undefined) spec.end = nl(args.end);
  if (spec.file !== undefined && basename(String(spec.file)) !== base)
    fail(`spec.file "${spec.file}" tidak cocok dengan --file "${base}" — spec ini untuk template lain`);
  const KNOWN = new Set(['file', 'title', 'sub', 'end', 'caps', 'shots', 'vo', 'props']);
  for (const k of Object.keys(spec)) {
    if (!KNOWN.has(k)) warn(`field spec "${k}" tidak dikenal — diabaikan (field yang dikenal: file, title, sub, end, caps, shots, vo, props)`);
  }
  const src = await readFile(srcPath, 'utf8');
  const LEN = readLEN(src, base);
  const creditBefore = countCredit(src);

  // ---- validasi pola teks (setText diam-diam no-op bila pola tidak ada) ----
  const TITLE_RE = /(<div id="title">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/;
  const SUB_RE = /(<div id="title">[\s\S]*?<small\b[^>]*>)([\s\S]*?)(<\/small><\/div>)/;
  const END_RE = /(<div id="end">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<b class="cr">[\s\S]*?<\/b>)?(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/;
  if (spec.title !== undefined && !TITLE_RE.test(src)) fail('pola judul #title tidak ditemukan di template');
  if (spec.sub !== undefined && !SUB_RE.test(src)) fail('pola subjudul #title small tidak ditemukan di template');
  if (spec.end !== undefined && !END_RE.test(src)) fail('pola end card #end tidak ditemukan di template');

  // ---- caps: arity template + validasi keras (termasuk kata/detik) ----
  const tplCaps = parseCaps(src);
  if (!tplCaps) fail('caps[] template tidak bisa di-parse (format tidak sesuai harapan)');
  const arity = tplCaps[0] ? tplCaps[0].length : 4;
  if (spec.caps !== undefined) {
    if (!Array.isArray(spec.caps)) fail('caps harus array [[t0,t1,"teks",speaker?],...]');
    if (spec.caps.some((c) => !Array.isArray(c) || c.length !== arity))
      fail(`caps spec arity harus ${arity} seperti template ini ([t0,t1,teks]${arity === 4 ? ' atau [t0,t1,teks,speaker]' : ''})`);
    // Kata/detik: validateCaps() menandainya warning (untuk UI Studio);
    // CLI memberlakukannya sebagai ERROR (tugas skill).
    spec.caps.forEach((c, i) => {
      const w = String(c[2] || '').trim().split(/\s+/).filter(Boolean).length;
      const wps = w / (c[1] - c[0]);
      if (wps > MAX_WPS + 1e-9) fail(`caps[${i}] terlalu cepat: ${w} kata / ${(c[1] - c[0]).toFixed(1)} dtk = ${wps.toFixed(2)} kata/detik (maks ${MAX_WPS}) — perpanjang jendela atau persingkat teks: "${c[2]}"`);
    });
  }
  if (spec.shots !== undefined) {
    if (!Array.isArray(spec.shots)) fail('shots harus array [[t0,[x,y,z],[x,y,z]],...]');
    validateShots(spec.shots, LEN);
  }
  // ---- vo: harus paralel dengan caps akhir ----
  const finalCapsLen = spec.caps ? spec.caps.length : tplCaps.length;
  if (spec.vo !== undefined) {
    if (!Array.isArray(spec.vo) || spec.vo.some((v) => typeof v !== 'string' || !v.trim()))
      fail('vo harus array string tak kosong');
    if (spec.vo.length !== finalCapsLen)
      fail(`vo panjang ${spec.vo.length}, padahal caps ada ${finalCapsLen} — VO[] harus paralel dengan caps[]`);
    if (voKind(src) === 'none') fail('VO= tidak ditemukan di template');
  }

  // ---- props: normalisasi bentuk, id dikenal, tersedia di template ini ----
  let props;
  try {
    props = normalizeProps(spec.props);
  } catch (e) {
    fail(e.message);
  }
  const touched = new Set(Object.keys(props));
  for (const id of Object.keys(props)) {
    const def = PROP_DEFS.find((d) => d.id === id);
    if (!def) fail(`props: id "${id}" tidak dikenal — jalankan: node scripts/apply-edit.mjs --list-props ${base}`);
    if (!def.files.includes(base)) fail(`props: "${id}" tidak tersedia di ${base}: ${def.unavailableReason}`);
    const cur = readProp(src, def, base);
    if (cur === null) fail(`props: pola literal "${id}" tidak ditemukan di ${base} (template tidak sesuai harapan)`);
  }
  const errors = [], warnings = [];
  if (spec.caps) { const v = validateCaps(spec.caps, LEN); errors.push(...v.errors); warnings.push(...v.warnings.filter((w) => !/kata\/detik/.test(w))); }
  if (spec.shots) { const v = validateShots(spec.shots, LEN); errors.push(...v.errors); warnings.push(...v.warnings); }
  if (Object.keys(props).length) { const v = validateProps(props, base, LEN); errors.push(...v.errors); warnings.push(...v.warnings); }
  warnings.forEach((w) => warn(w));
  if (errors.length) { errors.forEach((e) => console.error(`apply-edit: error: ${e}`)); process.exit(1); }

  // ---- terapkan (semua validasi sudah lolos; belum ada yang ditulis) ----
  const r = applyEdits(src, { ...spec, file: base, props }, LEN);
  if (!r.ok) fail(`gagal menerapkan: ${r.failed.join(', ')}`);
  let out = r.html;
  if (r.voFollowedCaps && spec.caps && spec.vo === undefined) {
    if (voKind(src) === 'literal') warn('caps berubah tapi spec tidak berisi "vo": VO[] diperbarui mengikuti teks caps baru.');
    else note('VO turunan (caps.map): otomatis mengikuti teks caps baru.');
  }
  // ---- validasi silang pada HTML akhir ----
  const cc = crossCheckFinal(out, base, touched, LEN);
  cc.warnings.forEach((w) => warn(w));
  if (cc.errors.length) { cc.errors.forEach((e) => console.error(`apply-edit: error: ${e}`)); process.exit(1); }
  // ---- syntax check + kredit ----
  syntaxCheckAll(out);
  if (countCredit(out) < creditBefore) fail('kredit @hanzvibes berkurang sesudah edit (template harus selalu memuatnya 2 tempat)');
  // ---- tulis output (tidak pernah ke public/templates / menimpa input) ----
  const outPath = resolve(args.out || base.replace(/\.html$/, '') + '.edited.html');
  if (outPath === srcPath) fail('--out sama dengan file input — template asli tidak boleh ditimpa');
  if (outPath === TPL_DIR || outPath.startsWith(TPL_DIR + sep)) fail('--out tidak boleh di dalam public/templates/ — template asli tidak boleh ditimpa');
  await writeFile(outPath, out, 'utf8');
  console.log(`ok → ${outPath} (diterapkan: ${r.applied.join(', ') || 'tidak ada perubahan'}${r.voFollowedCaps ? ' · VO mengikuti teks caption' : ''})`);
}
