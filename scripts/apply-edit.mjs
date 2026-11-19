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
  {
    "id": "claude.x",
    "label": "Maskot oranye · Geser kiri-kanan",
    "obj": "claude",
    "plain": "Geser kiri-kanan",
    "group": "Maskot oranye",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "unit": "",
    "rangeByFile": {
      "template-typing.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      },
      "template-deploy.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      },
      "template-bughunter.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      },
      "template-bomb.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      },
      "template-meeting.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      },
      "template-sleep.html": {
        "min": -2,
        "max": 2,
        "step": 0.05
      }
    },
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html",
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "array",
      "name": "X",
      "index": 0
    },
    "anchorByFile": {
      "template-perang.html": {
        "t": "array",
        "name": "gx",
        "index": 0
      },
      "template-typing.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [
          [
            [
              " const x=t<19?sy*.45:Math.sin((t-19)*1.4)*.2*sm(cl((t-19)/.5,0,1));",
              " const x=t<19?sy*SWAY:Math.sin((t-19)*1.4)*.2*sm(cl((t-19)/.5,0,1));"
            ],
            [
              " const x=MX0+(t<19?sy*.45:Math.sin((t-19)*1.4)*.2*sm(cl((t-19)/.5,0,1)));",
              " const x=MX0+(t<19?sy*SWAY:Math.sin((t-19)*1.4)*.2*sm(cl((t-19)/.5,0,1)));"
            ]
          ]
        ]
      },
      "template-deploy.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [
          [
            [
              " const x=sy*.45+Math.sin((t-19)*1.4)*.2*s2(23,23.5);",
              " const x=sy*SWAY+Math.sin((t-19)*1.4)*.2*s2(23,23.5);"
            ],
            [
              " const x=MX0+sy*.45+Math.sin((t-19)*1.4)*.2*s2(23,23.5);",
              " const x=MX0+sy*SWAY+Math.sin((t-19)*1.4)*.2*s2(23,23.5);"
            ]
          ]
        ]
      },
      "template-bughunter.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [
          [
            [
              " const x=sy*.45+Math.sin((t-27)*1.4)*.2*s2(27.6,28);",
              " const x=sy*SWAY+Math.sin((t-27)*1.4)*.2*s2(27.6,28);"
            ],
            [
              " const x=MX0+sy*.45+Math.sin((t-27)*1.4)*.2*s2(27.6,28);",
              " const x=MX0+sy*SWAY+Math.sin((t-27)*1.4)*.2*s2(27.6,28);"
            ]
          ]
        ]
      },
      "template-bomb.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [[[" const x=sy*.45;", " const x=sy*SWAY;"], [" const x=MX0+sy*.45;", " const x=MX0+sy*SWAY;"]]]
      },
      "template-meeting.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [
          [
            [" const x=sy*.4,shk=Math.max(mute,tw);", " const x=sy*SWAY,shk=Math.max(mute,tw);"],
            [" const x=MX0+sy*.4,shk=Math.max(mute,tw);", " const x=MX0+sy*SWAY,shk=Math.max(mute,tw);"]
          ]
        ]
      },
      "template-sleep.html": {
        "t": "const-sites",
        "name": "MX0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [
          [
            [
              " const x=t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*.6:0;",
              " const x=t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*SWAY:0;"
            ],
            [
              " const x=MX0+(t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*.6:0);",
              " const x=MX0+(t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*SWAY:0);"
            ]
          ]
        ]
      }
    },
    "hint": "Maskot oranye bergeser ke kiri atau ke kanan."
  },
  {
    "id": "codex.x",
    "label": "Maskot biru · Geser kiri-kanan",
    "obj": "codex",
    "plain": "Geser kiri-kanan",
    "group": "Maskot biru",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "array",
      "name": "X",
      "index": 1
    },
    "anchorByFile": {
      "template-perang.html": {
        "t": "array",
        "name": "gx",
        "index": 1
      }
    },
    "hint": "Maskot biru bergeser ke kiri atau ke kanan."
  },
  {
    "id": "gemini.x",
    "label": "Maskot ungu · Geser kiri-kanan",
    "obj": "gemini",
    "plain": "Geser kiri-kanan",
    "group": "Maskot ungu",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": ["template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "array",
      "name": "X",
      "index": 2
    },
    "hint": "Maskot ungu bergeser ke kiri atau ke kanan."
  },
  {
    "id": "claude.scale",
    "label": "Maskot oranye · Besar-kecil",
    "obj": "claude",
    "plain": "Besar-kecil",
    "group": "Maskot oranye",
    "kind": "number",
    "min": 0.5,
    "max": 1.3,
    "step": 0.05,
    "unit": "×",
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html",
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "inject-call",
      "after": "const cm=new THREE.Group();S.add(cm);",
      "text": "cm.scale.setScalar(1);",
      "prefix": "cm.scale.setScalar(",
      "index": 0,
      "default": 1
    },
    "anchorByFile": {
      "template-typing.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-deploy.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-bughunter.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-bomb.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-meeting.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-sleep.html": {
        "t": "inject-call",
        "after": "const mas=new THREE.Group();S.add(mas);",
        "text": "mas.scale.setScalar(1);",
        "prefix": "mas.scale.setScalar(",
        "index": 0,
        "default": 1
      },
      "template-perang.html": {
        "t": "array",
        "name": "gs",
        "index": 0
      }
    },
    "hint": "Maskot oranye membesar atau mengecil."
  },
  {
    "id": "codex.scale",
    "label": "Maskot biru · Besar-kecil",
    "obj": "codex",
    "plain": "Besar-kecil",
    "group": "Maskot biru",
    "kind": "number",
    "min": 0.5,
    "max": 1.3,
    "step": 0.05,
    "unit": "×",
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "dm.scale.setScalar(",
      "index": 0
    },
    "anchorByFile": {
      "template-perang.html": {
        "t": "array",
        "name": "gs",
        "index": 1
      }
    },
    "hint": "Maskot biru membesar atau mengecil."
  },
  {
    "id": "gemini.scale",
    "label": "Maskot ungu · Besar-kecil",
    "obj": "gemini",
    "plain": "Besar-kecil",
    "group": "Maskot ungu",
    "kind": "number",
    "min": 0.5,
    "max": 1.3,
    "step": 0.05,
    "unit": "×",
    "files": ["template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "gm.scale.setScalar(",
      "index": 0
    },
    "hint": "Maskot ungu membesar atau mengecil."
  },
  {
    "id": "claude.z",
    "label": "Maskot oranye · Maju-mundur",
    "obj": "claude",
    "plain": "Maju-mundur",
    "group": "Maskot oranye",
    "kind": "number",
    "min": -1,
    "max": 1,
    "step": 0.05,
    "rangeByFile": {
      "template-typing.html": {
        "min": 0,
        "max": 1.2,
        "step": 0.05
      },
      "template-deploy.html": {
        "min": 0,
        "max": 1.2,
        "step": 0.05
      },
      "template-bughunter.html": {
        "min": 0,
        "max": 1.2,
        "step": 0.05
      },
      "template-bomb.html": {
        "min": 0,
        "max": 1.2,
        "step": 0.05
      },
      "template-meeting.html": {
        "min": 0,
        "max": 1.2,
        "step": 0.05
      },
      "template-sleep.html": {
        "min": -0.4,
        "max": 0.4,
        "step": 0.05
      }
    },
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html",
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "MZ",
      "before": "function frame(t){",
      "default": [0, 0],
      "sites": [],
      "index": 0,
      "sitesByFile": {
        "template.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-trio.html": [[",h,0);", ",h,MZ[i]);"]],
        "template-code.html": [[",hp[i],-.1*wr);", ",hp[i],MZ[i]-.1*wr);"]],
        "template-kuota.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-rival.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-perang.html": [[",hp[i],.7);", ",hp[i],.7+MZ[i]);"]]
      }
    },
    "anchorByFile": {
      "template-typing.html": {
        "t": "call",
        "prefix": "mas.position.set(",
        "index": 2
      },
      "template-deploy.html": {
        "t": "call",
        "prefix": "mas.position.set(",
        "index": 2
      },
      "template-bughunter.html": {
        "t": "call",
        "prefix": "mas.position.set(",
        "index": 2
      },
      "template-bomb.html": {
        "t": "call",
        "prefix": "mas.position.set(",
        "index": 2
      },
      "template-meeting.html": {
        "t": "call",
        "prefix": "mas.position.set(",
        "index": 2
      },
      "template-sleep.html": {
        "t": "const-sites",
        "name": "MZ0",
        "before": "function frame(t){",
        "default": 0,
        "sites": [["mas.position.z=.55+", "mas.position.z=(.55+MZ0)+"]]
      }
    },
    "hint": "Maskot oranye maju ke arah penonton atau mundur ke arah layar."
  },
  {
    "id": "codex.z",
    "label": "Maskot biru · Maju-mundur",
    "obj": "codex",
    "plain": "Maju-mundur",
    "group": "Maskot biru",
    "kind": "number",
    "min": -1,
    "max": 1,
    "step": 0.05,
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "MZ",
      "before": "function frame(t){",
      "default": [0, 0],
      "sites": [],
      "index": 1,
      "sitesByFile": {
        "template.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-trio.html": [[",h,0);", ",h,MZ[i]);"]],
        "template-code.html": [[",hp[i],-.1*wr);", ",hp[i],MZ[i]-.1*wr);"]],
        "template-kuota.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-rival.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-perang.html": [[",hp[i],.7);", ",hp[i],.7+MZ[i]);"]]
      }
    },
    "hint": "Maskot biru maju ke arah penonton atau mundur ke arah layar."
  },
  {
    "id": "gemini.z",
    "label": "Maskot ungu · Maju-mundur",
    "obj": "gemini",
    "plain": "Maju-mundur",
    "group": "Maskot ungu",
    "kind": "number",
    "min": -1,
    "max": 1,
    "step": 0.05,
    "files": ["template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "MZ",
      "before": "function frame(t){",
      "default": [0, 0, 0],
      "sites": [],
      "index": 2,
      "sitesByFile": {
        "template.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-trio.html": [[",h,0);", ",h,MZ[i]);"]],
        "template-code.html": [[",hp[i],-.1*wr);", ",hp[i],MZ[i]-.1*wr);"]],
        "template-kuota.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-rival.html": [[",hp[i],0);", ",hp[i],MZ[i]);"]],
        "template-perang.html": [[",hp[i],.7);", ",hp[i],.7+MZ[i]);"]]
      }
    },
    "hint": "Maskot ungu maju ke arah penonton atau mundur ke arah layar."
  },
  {
    "id": "claude.sway",
    "label": "Maskot oranye · Goyangan",
    "obj": "claude",
    "plain": "Goyangan",
    "group": "Maskot oranye",
    "kind": "number",
    "min": 0,
    "max": 0.9,
    "step": 0.05,
    "rangeByFile": {
      "template-meeting.html": {
        "min": 0,
        "max": 0.9,
        "step": 0.05
      },
      "template-sleep.html": {
        "min": 0,
        "max": 0.9,
        "step": 0.05
      }
    },
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "SWAY",
      "before": "function frame(t){",
      "default": 0.45,
      "sites": [],
      "sitesByFile": {
        "template-typing.html": [["sy*.45", "sy*SWAY"]],
        "template-deploy.html": [["sy*.45", "sy*SWAY"]],
        "template-bughunter.html": [["sy*.45", "sy*SWAY"]],
        "template-bomb.html": [["sy*.45", "sy*SWAY"]],
        "template-meeting.html": [["sy*.4,", "sy*SWAY,"]],
        "template-sleep.html": [["*.6:0", "*SWAY:0"]]
      }
    },
    "hint": "0 = berdiri diam, makin besar makin lebar goyangannya saat bekerja."
  },
  {
    "id": "eyes.tilt",
    "label": "Mata · Miring mata",
    "obj": "eyes",
    "plain": "Miring mata",
    "group": "Mata",
    "kind": "number",
    "min": -0.5,
    "max": 0.5,
    "step": 0.05,
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html",
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "EYE_TILT",
      "before": "function frame(t){",
      "default": 0,
      "sites": [],
      "sitesByFile": {
        "template.html": [["-.4*ar+.5*jy;", "-.4*ar+.5*jy+EYE_TILT;"], [".4*ar-.5*jy;", ".4*ar-.5*jy-EYE_TILT;"]],
        "template-trio.html": [
          [
            "eL.rotation.z=geL.rotation.z=-.4*ar+.5*jy;",
            "eL.rotation.z=-.4*ar+.5*jy+EYE_TILT;geL.rotation.z=-.4*ar+.5*jy+EYE_TILT;"
          ],
          [
            "eR.rotation.z=geR.rotation.z=.4*ar-.5*jy;",
            "eR.rotation.z=.4*ar-.5*jy-EYE_TILT;geR.rotation.z=.4*ar-.5*jy-EYE_TILT;"
          ]
        ],
        "template-code.html": [
          ["eL.rotation.z=(-.4*ar+.5*jy)*(1-sh);", "eL.rotation.z=(-.4*ar+.5*jy)*(1-sh)+EYE_TILT;"],
          ["eR.rotation.z=(.4*ar-.5*jy)*(1-sh);", "eR.rotation.z=(.4*ar-.5*jy)*(1-sh)-EYE_TILT;"]
        ],
        "template-kuota.html": [["-.4*ang+.5*jy;", "-.4*ang+.5*jy+EYE_TILT;"], [".4*ang-.5*jy;", ".4*ang-.5*jy-EYE_TILT;"]],
        "template-rival.html": [["-.4*ang+.5*jy;", "-.4*ang+.5*jy+EYE_TILT;"], [".4*ang-.5*jy;", ".4*ang-.5*jy-EYE_TILT;"]],
        "template-perang.html": [["-.4*ang+.5*jy;", "-.4*ang+.5*jy+EYE_TILT;"], [".4*ang-.5*jy;", ".4*ang-.5*jy-EYE_TILT;"]],
        "template-typing.html": [
          ["eL.rotation.z=.5*hF;", "eL.rotation.z=.5*hF+EYE_TILT;"],
          ["eR.rotation.z=-.5*hF;", "eR.rotation.z=-.5*hF-EYE_TILT;"]
        ],
        "template-deploy.html": [
          ["eL.rotation.z=.5*hF;", "eL.rotation.z=.5*hF+EYE_TILT;"],
          ["eR.rotation.z=-.5*hF;", "eR.rotation.z=-.5*hF-EYE_TILT;"]
        ],
        "template-bughunter.html": [
          ["eL.rotation.z=.5*hF;", "eL.rotation.z=.5*hF+EYE_TILT;"],
          ["eR.rotation.z=-.5*hF;", "eR.rotation.z=-.5*hF-EYE_TILT;"]
        ],
        "template-bomb.html": [
          ["eL.rotation.z=.5*hF;", "eL.rotation.z=.5*hF+EYE_TILT;"],
          ["eR.rotation.z=-.5*hF;", "eR.rotation.z=-.5*hF-EYE_TILT;"]
        ],
        "template-meeting.html": [["-.15*tw;", "-.15*tw+EYE_TILT;"], ["+.15*tw;", "+.15*tw-EYE_TILT;"]],
        "template-sleep.html": [
          ["eL.rotation.z=.5*hpy;", "eL.rotation.z=.5*hpy+EYE_TILT;"],
          ["eR.rotation.z=-.5*hpy;", "eR.rotation.z=-.5*hpy-EYE_TILT;"]
        ]
      }
    },
    "hint": "Mata miring ke atas seperti senang, atau ke bawah seperti marah."
  },
  {
    "id": "face.codex",
    "label": "Maskot biru · Wajah di layar biru",
    "obj": "codex",
    "plain": "Wajah di layar biru",
    "group": "Maskot biru",
    "kind": "number",
    "min": -1,
    "max": 3,
    "step": 1,
    "control": "choice",
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "FACE_OVR",
      "before": "function frame(t){",
      "default": -1,
      "sites": [],
      "sitesByFile": {
        "template.html": [
          [
            "drawFace(jy>.5?2:tr>.5?3:(s2(6,6.5)*(1-s2(16,16.5))>.5)?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:tr>.5?3:(s2(6,6.5)*(1-s2(16,16.5))>.5)?1:0,bl>.5?1:0);"
          ]
        ],
        "template-trio.html": [
          [
            "drawFace(jy>.5?2:tr>.5?3:ar>.5?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:tr>.5?3:ar>.5?1:0,bl>.5?1:0);"
          ]
        ],
        "template-code.html": [
          [
            "drawFace(jy>.5?2:(sh>.3||ar>.45)?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:(sh>.3||ar>.45)?1:0,bl>.5?1:0);"
          ]
        ],
        "template-kuota.html": [
          [
            "drawFace(jy>.5?2:(ang>.5)?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:(ang>.5)?1:0,bl>.5?1:0);"
          ]
        ],
        "template-rival.html": [
          [
            "drawFace(jy>.5?2:(ang>.5)?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:(ang>.5)?1:0,bl>.5?1:0);"
          ]
        ],
        "template-perang.html": [
          [
            "drawFace(jy>.5?2:ko>.5?3:ang>.5?1:0,bl>.5?1:0);",
            "drawFace(FACE_OVR>=0?FACE_OVR:jy>.5?2:ko>.5?3:ang>.5?1:0,bl>.5?1:0);"
          ]
        ]
      }
    },
    "hint": "Wajah yang tampil di layar biru — atau biarkan mengikuti cerita."
  },
  {
    "id": "claude.color",
    "label": "Maskot oranye · Warna",
    "obj": "claude",
    "plain": "Warna",
    "group": "Maskot oranye",
    "kind": "color",
    "control": "color",
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html",
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "OR=M(0x"
    },
    "hint": "Warna maskot oranye — garis tepi balon katanya ikut berubah."
  },
  {
    "id": "codex.color",
    "label": "Maskot biru · Warna",
    "obj": "codex",
    "plain": "Warna",
    "group": "Maskot biru",
    "kind": "color",
    "control": "color",
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "VI=M(0x"
    },
    "hint": "Warna maskot biru."
  },
  {
    "id": "gemini.color",
    "label": "Maskot ungu · Warna",
    "obj": "gemini",
    "plain": "Warna",
    "group": "Maskot ungu",
    "kind": "color",
    "control": "color",
    "files": ["template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "lg=new THREE.SpotLight(0x"
    },
    "hint": "Warna maskot ungu."
  },
  {
    "id": "board.y",
    "label": "Papan skor · Tinggi papan",
    "obj": "board",
    "plain": "Tinggi papan",
    "group": "Papan skor",
    "kind": "number",
    "min": 2.5,
    "max": 6.5,
    "step": 0.1,
    "files": [
      "template.html",
      "template-code.html",
      "template-kuota.html",
      "template-rival.html",
      "template-trio.html",
      "template-perang.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "board.position.set(",
      "index": 1
    },
    "hint": "Papan skor naik atau turun di dinding."
  },
  {
    "id": "board.base",
    "label": "Papan skor · Angka awal",
    "obj": "board",
    "plain": "Angka awal",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 90,
    "step": 1,
    "unit": "poin",
    "files": ["template.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "SC_BASE",
      "before": "function frame(t){",
      "default": 55,
      "sites": [["ra=55+", "ra=SC_BASE+"], ["rb=55+", "rb=SC_BASE+"]],
      "sitesByFile": {
        "template-trio.html": [["(55+", "(SC_BASE+"], ["(90-55-", "(90-SC_BASE-"]]
      }
    },
    "hint": "Angka papan di awal debat."
  },
  {
    "id": "board.swing",
    "label": "Papan skor · Naik-turun angka",
    "obj": "board",
    "plain": "Naik-turun angka",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 45,
    "step": 1,
    "unit": "poin",
    "rangeByFile": {
      "template-rival.html": {
        "min": 0,
        "max": 0.2,
        "step": 0.01
      }
    },
    "files": ["template.html", "template-trio.html", "template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "SC_SWING",
      "before": "function frame(t){",
      "default": 38,
      "sites": [["38*Math.sin(t*1.1", "SC_SWING*Math.sin(t*1.1"]],
      "sitesByFile": {
        "template-trio.html": [["38*Math.sin(t*1.1+o)", "SC_SWING*Math.sin(t*1.1+o)"]],
        "template-rival.html": [[".05*Math.sin(t*3", "RV_WOB*Math.sin(t*3"]]
      }
    },
    "anchorByFile": {
      "template-rival.html": {
        "t": "const-sites",
        "name": "RV_WOB",
        "before": "function frame(t){",
        "default": 0.05,
        "sites": [[".05*Math.sin(t*3", "RV_WOB*Math.sin(t*3"]]
      }
    },
    "hint": "Seberapa jauh angka papan naik-turun selama debat."
  },
  {
    "id": "board.final",
    "label": "Papan skor · Angka akhir",
    "obj": "board",
    "plain": "Angka akhir",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 100,
    "step": 1,
    "unit": "poin",
    "files": ["template.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "SC_FINAL",
      "before": "function frame(t){",
      "default": 90,
      "sites": [["(90-ra)", "(SC_FINAL-ra)"], ["(90-rb)", "(SC_FINAL-rb)"]],
      "also": [
        {
          "name": "SC_BASE",
          "before": "function frame(t){",
          "default": 55
        },
        {
          "name": "SC_SWING",
          "before": "function frame(t){",
          "default": 38
        }
      ],
      "sitesByFile": {
        "template-trio.html": [
          [
            ["(90-55-38*Math.sin(t*1.1+o)", "(90-SC_BASE-SC_SWING*Math.sin(t*1.1+o)"],
            "(SC_FINAL-SC_BASE-SC_SWING*Math.sin(t*1.1+o)"
          ]
        ]
      }
    },
    "hint": "Angka akhir papan saat hasil seri ditunjukkan."
  },
  {
    "id": "board.top",
    "label": "Papan skor · Angka tertinggi",
    "obj": "board",
    "plain": "Angka tertinggi",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 100,
    "step": 1,
    "unit": "poin",
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "RV_TOP",
      "before": "function frame(t){",
      "default": 90,
      "sites": [["LV=90*", "LV=RV_TOP*"]]
    },
    "hint": "Angka dendam tertinggi di papan."
  },
  {
    "id": "board.back",
    "label": "Papan skor · Angka saat musuhan lagi",
    "obj": "board",
    "plain": "Angka saat musuhan lagi",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 100,
    "step": 1,
    "unit": "poin",
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "RV_BACK",
      "before": "function frame(t){",
      "default": 85,
      "sites": [["+85*s2", "+RV_BACK*s2"]]
    },
    "hint": "Angka dendam saat mereka musuhan lagi di akhir."
  },
  {
    "id": "board.read",
    "label": "Papan skor · Angka file dibaca",
    "obj": "board",
    "plain": "Angka file dibaca",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 5,
    "step": 0.1,
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "BD_READ",
      "before": "function frame(t){",
      "default": 2.9,
      "sites": [["spd*2.9", "spd*BD_READ"]]
    },
    "hint": "Angka “file dibaca” di papan, mengikuti sisa kuota."
  },
  {
    "id": "board.write",
    "label": "Papan skor · Angka kata dijawab",
    "obj": "board",
    "plain": "Angka kata dijawab",
    "group": "Papan skor",
    "kind": "number",
    "min": 0,
    "max": 5,
    "step": 0.1,
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "BD_WRITE",
      "before": "function frame(t){",
      "default": 2.2,
      "sites": [["spd*2.2", "spd*BD_WRITE"]]
    },
    "hint": "Angka “kata dijawab” di papan, mengikuti sisa kuota."
  },
  {
    "id": "board.claude.start",
    "label": "Papan skor · Angka awal oranye",
    "obj": "board",
    "plain": "Angka awal oranye",
    "group": "Papan skor",
    "kind": "array",
    "control": "scores",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "CL0"
    },
    "validate": boardScoreErr,
    "hint": "Tiga angka awal maskot oranye di papan."
  },
  {
    "id": "board.claude.final",
    "label": "Papan skor · Angka akhir oranye",
    "obj": "board",
    "plain": "Angka akhir oranye",
    "group": "Papan skor",
    "kind": "array",
    "control": "scores",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "CL1"
    },
    "validate": boardScoreErr,
    "hint": "Tiga angka akhir maskot oranye di papan."
  },
  {
    "id": "board.codex.start",
    "label": "Papan skor · Angka awal biru",
    "obj": "board",
    "plain": "Angka awal biru",
    "group": "Papan skor",
    "kind": "array",
    "control": "scores",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "CX0"
    },
    "validate": boardScoreErr,
    "hint": "Tiga angka awal maskot biru di papan."
  },
  {
    "id": "board.codex.final",
    "label": "Papan skor · Angka akhir biru",
    "obj": "board",
    "plain": "Angka akhir biru",
    "group": "Papan skor",
    "kind": "array",
    "control": "scores",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "CX1"
    },
    "validate": boardScoreErr,
    "hint": "Tiga angka akhir maskot biru di papan."
  },
  {
    "id": "monitor.claude.x",
    "label": "Layar kecil · Geser kiri-kanan",
    "obj": "monitor",
    "plain": "Geser kiri-kanan",
    "group": "Layar kecil",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "mkmon",
      "index": 0
    },
    "hint": "Layar kecil di belakang maskot oranye bergeser."
  },
  {
    "id": "monitor.codex.x",
    "label": "Layar kecil · Geser kiri-kanan",
    "obj": "monitor",
    "plain": "Geser kiri-kanan",
    "group": "Layar kecil",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "mkmon",
      "index": 1
    },
    "hint": "Layar kecil di belakang maskot biru bergeser."
  },
  {
    "id": "monitor.gemini.x",
    "label": "Layar kecil · Geser kiri-kanan",
    "obj": "monitor",
    "plain": "Geser kiri-kanan",
    "group": "Layar kecil",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": ["template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "mkmon",
      "index": 2
    },
    "hint": "Layar kecil di belakang maskot ungu bergeser."
  },
  {
    "id": "screen.x",
    "label": "Layar besar · Geser kiri-kanan",
    "obj": "screen",
    "plain": "Geser kiri-kanan",
    "group": "Layar besar",
    "kind": "number",
    "min": -2,
    "max": 2,
    "step": 0.05,
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "scr.position.set(",
      "index": 0
    },
    "hint": "Layar bergeser ke kiri atau ke kanan."
  },
  {
    "id": "screen.y",
    "label": "Layar besar · Tinggi layar",
    "obj": "screen",
    "plain": "Tinggi layar",
    "group": "Layar besar",
    "kind": "number",
    "min": 1,
    "max": 3,
    "step": 0.05,
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "scr.position.set(",
      "index": 1
    },
    "hint": "Layar naik atau turun."
  },
  {
    "id": "mug.x",
    "label": "Cangkir · Geser kiri-kanan",
    "obj": "mug",
    "plain": "Geser kiri-kanan",
    "group": "Cangkir",
    "kind": "number",
    "min": -3,
    "max": 3,
    "step": 0.05,
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "mug.position.set(",
      "index": 0
    },
    "hint": "Cangkir bergeser ke kiri atau ke kanan di atas meja."
  },
  {
    "id": "window.x",
    "label": "Jendela · Geser kiri-kanan",
    "obj": "window",
    "plain": "Geser kiri-kanan",
    "group": "Jendela",
    "kind": "number",
    "min": -4,
    "max": 0,
    "step": 0.05,
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "win.position.set(",
      "index": 0
    },
    "hint": "Jendela bergeser ke kiri atau ke kanan di dinding."
  },
  {
    "id": "lamp.x",
    "label": "Lampu · Geser kiri-kanan",
    "obj": "lamp",
    "plain": "Geser kiri-kanan",
    "group": "Lampu",
    "kind": "number",
    "min": -5,
    "max": 5,
    "step": 0.05,
    "files": [
      "template-typing.html",
      "template-deploy.html",
      "template-bughunter.html",
      "template-bomb.html",
      "template-meeting.html",
      "template-sleep.html"
    ],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "lamp.position.set(",
      "index": 0
    },
    "hint": "Lampu bergeser ke kiri atau ke kanan."
  },
  {
    "id": "screen.code",
    "label": "Layar besar · Isi kode di layar",
    "obj": "screen",
    "plain": "Isi kode di layar",
    "group": "Layar besar",
    "kind": "array",
    "control": "lines",
    "files": ["template-typing.html", "template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "CODE"
    },
    "anchorByFile": {
      "template-code.html": {
        "t": "whole",
        "name": "CODEL"
      }
    },
    "validate": screenCodeErr,
    "hint": "Kode yang tampil di layar besar — satu baris per baris."
  },
  {
    "id": "screen.fix",
    "label": "Layar besar · Baris perbaikan",
    "obj": "screen",
    "plain": "Baris perbaikan",
    "group": "Layar besar",
    "kind": "text",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "str",
      "name": "FIXL"
    },
    "validate": screenFixErr,
    "hint": "Baris kode pengganti yang muncul saat momen perbaikan."
  },
  {
    "id": "screen.cmd1",
    "label": "Layar besar · Perintah pertama",
    "obj": "screen",
    "plain": "Perintah pertama",
    "group": "Layar besar",
    "kind": "array",
    "control": "lines",
    "files": ["template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "L1"
    },
    "validate": screenCodeErr,
    "hint": "Perintah pertama yang diketik maskot di layar."
  },
  {
    "id": "screen.cmd2",
    "label": "Layar besar · Perintah perbaikan",
    "obj": "screen",
    "plain": "Perintah perbaikan",
    "group": "Layar besar",
    "kind": "array",
    "control": "lines",
    "files": ["template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "L2"
    },
    "validate": screenCodeErr,
    "hint": "Perintah perbaikan yang diketik sesudah gagal."
  },
  {
    "id": "screen.error",
    "label": "Layar besar · Pesan galat",
    "obj": "screen",
    "plain": "Pesan galat",
    "group": "Layar besar",
    "kind": "array",
    "control": "lines",
    "files": ["template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "ERR"
    },
    "validate": screenCodeErr,
    "hint": "Pesan galat merah di layar."
  },
  {
    "id": "screen.pipeline",
    "label": "Layar besar · Tahapan jalan",
    "obj": "screen",
    "plain": "Tahapan jalan",
    "group": "Layar besar",
    "kind": "array",
    "files": ["template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "two-whole",
      "names": ["RUN1", "RUN2"]
    },
    "validate": screenPipelineErr,
    "hint": "Tahapan jalan di layar — pasangan waktu mulai dan selesai tiap tahap."
  },
  {
    "id": "screen.editor",
    "label": "Layar besar · Isi layar editor",
    "obj": "screen",
    "plain": "Isi layar editor",
    "group": "Layar besar",
    "kind": "text",
    "control": "textarea",
    "files": ["template-bomb.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "block",
      "start": "const L=",
      "end": "]];"
    },
    "validate": screenEditorErr,
    "hint": "Isi editor di layar untuk tiap bagian cerita (4 bagian)."
  },
  {
    "id": "screen.chat",
    "label": "Layar besar · Isi obrolan",
    "obj": "screen",
    "plain": "Isi obrolan",
    "group": "Layar besar",
    "kind": "array",
    "files": ["template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "chat"
    },
    "validate": screenChatErr,
    "hint": "Obrolan di layar — waktu, nama, pesan, dan warna tiap baris."
  },
  {
    "id": "screen.prompt",
    "label": "Layar besar · Perintah yang diketik",
    "obj": "screen",
    "plain": "Perintah yang diketik",
    "group": "Layar besar",
    "kind": "text",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "str",
      "name": "PROMPT"
    },
    "validate": screenPromptErr,
    "hint": "Perintah yang diketik maskot di layar."
  },
  {
    "id": "screen.recent",
    "label": "Layar besar · Daftar obrolan lama",
    "obj": "screen",
    "plain": "Daftar obrolan lama",
    "group": "Layar besar",
    "kind": "array",
    "control": "lines",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "args-list",
      "prefix": "rec.push("
    },
    "validate": screenRecentErr,
    "hint": "Daftar obrolan lama di sisi layar — satu baris per baris."
  },
  {
    "id": "tank.curve",
    "label": "Tangki kuota · Isi tangki dari waktu ke waktu",
    "obj": "tank",
    "plain": "Isi tangki dari waktu ke waktu",
    "group": "Tangki kuota",
    "kind": "array",
    "control": "curve",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "RK"
    },
    "validate": tankCurveErr,
    "hint": "Tangki terisi atau berkurang mengikuti daftar ini sepanjang video."
  },
  {
    "id": "tank.color.full",
    "label": "Tangki kuota · Warna cairan saat penuh",
    "obj": "tank",
    "plain": "Warna cairan saat penuh",
    "group": "Tangki kuota",
    "kind": "color",
    "control": "color",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "cAm=new THREE.Color(0x"
    },
    "hint": "Warna cairan saat kuota masih penuh."
  },
  {
    "id": "tank.color.low",
    "label": "Tangki kuota · Warna cairan saat hampir habis",
    "obj": "tank",
    "plain": "Warna cairan saat hampir habis",
    "group": "Tangki kuota",
    "kind": "color",
    "control": "color",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "cRe=new THREE.Color(0x"
    },
    "hint": "Warna cairan saat kuota hampir habis."
  },
  {
    "id": "tank.color.reset",
    "label": "Tangki kuota · Warna cairan saat isi ulang",
    "obj": "tank",
    "plain": "Warna cairan saat isi ulang",
    "group": "Tangki kuota",
    "kind": "color",
    "control": "color",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "hex",
      "prefix": "cGr=new THREE.Color(0x"
    },
    "hint": "Warna kilau saat kuota diisi ulang."
  },
  {
    "id": "tank.x",
    "label": "Tangki kuota · Geser kiri-kanan",
    "obj": "tank",
    "plain": "Geser kiri-kanan",
    "group": "Tangki kuota",
    "kind": "number",
    "min": -2,
    "max": 2,
    "step": 0.05,
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "tkG.position.set(",
      "index": 0
    },
    "hint": "Tangki bergeser ke kiri atau ke kanan di antara kedua maskot."
  },
  {
    "id": "tank.z",
    "label": "Tangki kuota · Maju-mundur",
    "obj": "tank",
    "plain": "Maju-mundur",
    "group": "Tangki kuota",
    "kind": "number",
    "min": -2,
    "max": -0.5,
    "step": 0.05,
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "tkG.position.set(",
      "index": 2
    },
    "hint": "Tangki maju ke arah penonton atau mundur ke arah dinding."
  },
  {
    "id": "keyboard.x",
    "label": "Keyboard · Geser kiri-kanan",
    "obj": "keyboard",
    "plain": "Geser kiri-kanan",
    "group": "Keyboard",
    "kind": "number",
    "min": -1,
    "max": 1,
    "step": 0.05,
    "files": ["template-rival.html", "template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "KB_X",
      "before": "function frame(t){",
      "default": 0,
      "sites": [
        ["kb.position.set(0,.12,.8)", "kb.position.set(KB_X,KB_Y,KB_Z)"],
        ["kx=.3*Math.sin(t*5.5)*kw", "kx=KB_X+KB_SWAY*Math.sin(t*5.5)*kw"]
      ],
      "also": [
        {
          "name": "KB_Y",
          "before": "function frame(t){",
          "default": 0.12
        },
        {
          "name": "KB_Z",
          "before": "function frame(t){",
          "default": 0.8
        },
        {
          "name": "KB_SWAY",
          "before": "function frame(t){",
          "default": 0.3
        }
      ],
      "sitesByFile": {
        "template-kuota.html": [
          ["kb.position.set(0,.12,.8)", "kb.position.set(KB_X,KB_Y,KB_Z)"],
          ["kx=.3*Math.sin(t*5.5)*kw", "kx=KB_X+.3*Math.sin(t*5.5)*kw"]
        ]
      }
    },
    "hint": "Keyboard bergeser ke kiri atau ke kanan di atas meja."
  },
  {
    "id": "keyboard.sway",
    "label": "Keyboard · Goyangan saat diperebutkan",
    "obj": "keyboard",
    "plain": "Goyangan saat diperebutkan",
    "group": "Keyboard",
    "kind": "number",
    "min": 0,
    "max": 0.6,
    "step": 0.05,
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "KB_SWAY",
      "before": "function frame(t){",
      "default": 0.3,
      "sites": [["kx=.3*Math.sin(t*5.5)*kw", "kx=KB_X+KB_SWAY*Math.sin(t*5.5)*kw"]],
      "also": [
        {
          "name": "KB_X",
          "before": "function frame(t){",
          "default": 0
        }
      ]
    },
    "hint": "0 = diam, makin besar makin jauh keyboard terombang-ambing."
  },
  {
    "id": "keyboard.y",
    "label": "Keyboard · Naik-turun",
    "obj": "keyboard",
    "plain": "Naik-turun",
    "group": "Keyboard",
    "kind": "number",
    "min": 0,
    "max": 0.5,
    "step": 0.05,
    "files": ["template-rival.html", "template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "KB_Y",
      "before": "function frame(t){",
      "default": 0.12,
      "sites": [
        ["kb.position.set(0,.12,.8)", "kb.position.set(KB_X,KB_Y,KB_Z)"],
        [
          [
            "kb.position.set(kx,.12+.05*kw*Math.abs(Math.sin(t*5.5)),.8)",
            "kb.position.set(kx,.12+.05*kw*Math.abs(Math.sin(t*5.5)),KB_Z)"
          ],
          "kb.position.set(kx,KB_Y+.05*kw*Math.abs(Math.sin(t*5.5)),KB_Z)"
        ]
      ],
      "also": [
        {
          "name": "KB_X",
          "before": "function frame(t){",
          "default": 0
        },
        {
          "name": "KB_Z",
          "before": "function frame(t){",
          "default": 0.8
        }
      ]
    },
    "hint": "Keyboard naik atau turun dari meja."
  },
  {
    "id": "keyboard.z",
    "label": "Keyboard · Maju-mundur",
    "obj": "keyboard",
    "plain": "Maju-mundur",
    "group": "Keyboard",
    "kind": "number",
    "min": 0,
    "max": 1.5,
    "step": 0.05,
    "files": ["template-rival.html", "template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "KB_Z",
      "before": "function frame(t){",
      "default": 0.8,
      "sites": [
        ["kb.position.set(0,.12,.8)", "kb.position.set(KB_X,KB_Y,KB_Z)"],
        [
          [
            "kb.position.set(kx,.12+.05*kw*Math.abs(Math.sin(t*5.5)),.8)",
            "kb.position.set(kx,KB_Y+.05*kw*Math.abs(Math.sin(t*5.5)),.8)"
          ],
          "kb.position.set(kx,KB_Y+.05*kw*Math.abs(Math.sin(t*5.5)),KB_Z)"
        ]
      ],
      "also": [
        {
          "name": "KB_X",
          "before": "function frame(t){",
          "default": 0
        },
        {
          "name": "KB_Y",
          "before": "function frame(t){",
          "default": 0.12
        }
      ]
    },
    "hint": "Keyboard maju ke arah maskot atau mundur menjauhinya."
  },
  {
    "id": "rival.notes",
    "label": "Catatan tempel · Isi catatan tempel",
    "obj": "notes",
    "plain": "Isi catatan tempel",
    "group": "Catatan tempel",
    "kind": "array",
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "NT"
    },
    "validate": rivalNotesErr,
    "hint": "Tulisan di catatan tempel di dinding."
  },
  {
    "id": "war.spawns",
    "label": "Pasukan kecil · Waktu pasukan muncul",
    "obj": "troops",
    "plain": "Waktu pasukan muncul",
    "group": "Pasukan kecil",
    "kind": "array",
    "control": "spawns",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "SP"
    },
    "validate": warSpawnsErr,
    "hint": "Pasukan kecil muncul pada waktu-waktu ini."
  },
  {
    "id": "war.catapults",
    "label": "Katapel · Waktu tembakan",
    "obj": "catapult",
    "plain": "Waktu tembakan",
    "group": "Katapel",
    "kind": "array",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "EV"
    },
    "validate": warCatapultsErr,
    "hint": "Koin ditembakkan pada waktu-waktu ini."
  },
  {
    "id": "fort.distance",
    "label": "Benteng · Jarak dari tengah",
    "obj": "fort",
    "plain": "Jarak dari tengah",
    "group": "Benteng",
    "kind": "number",
    "min": 3.5,
    "max": 4.5,
    "step": 0.1,
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "FORT_X",
      "before": "// benteng kardus",
      "default": 3.7,
      "sites": [["sx*3.7", "sx*FORT_X"]]
    },
    "hint": "Kedua benteng menjauh atau mendekat dari tengah secara simetris."
  },
  {
    "id": "fort.depth",
    "label": "Benteng · Maju-mundur",
    "obj": "fort",
    "plain": "Maju-mundur",
    "group": "Benteng",
    "kind": "number",
    "min": -2.2,
    "max": -0.8,
    "step": 0.05,
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "FORT_Z",
      "before": "// benteng kardus",
      "default": -1.6,
      "sites": [[",0,-1.6)", ",0,FORT_Z)"]]
    },
    "hint": "Kedua benteng maju ke arah penonton atau mundur ke arah dinding."
  },
  {
    "id": "fort.size",
    "label": "Benteng · Besar-kecil",
    "obj": "fort",
    "plain": "Besar-kecil",
    "group": "Benteng",
    "kind": "number",
    "min": 0.7,
    "max": 1.3,
    "step": 0.05,
    "unit": "×",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-line",
      "name": "FORT_S",
      "before": "// benteng kardus",
      "default": 1,
      "after": "const mkFort=",
      "insertText": "g.scale.setScalar(FORT_S);",
      "insertAfter": "S.add(g);"
    },
    "hint": "Kedua benteng membesar atau mengecil beserta benderanya."
  },
  {
    "id": "fort.claude.text",
    "label": "Benteng · Tulisan bendera kiri",
    "obj": "fort",
    "plain": "Tulisan bendera kiri",
    "group": "Benteng",
    "kind": "text",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "fort-field",
      "side": 0,
      "field": "text"
    },
    "validate": fortTextErr,
    "hint": "Tulisan di bendera kiri."
  },
  {
    "id": "fort.codex.text",
    "label": "Benteng · Tulisan bendera kanan",
    "obj": "fort",
    "plain": "Tulisan bendera kanan",
    "group": "Benteng",
    "kind": "text",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "fort-field",
      "side": 1,
      "field": "text"
    },
    "validate": fortTextErr,
    "hint": "Tulisan di bendera kanan."
  },
  {
    "id": "fort.claude.color",
    "label": "Benteng · Warna bendera kiri",
    "obj": "fort",
    "plain": "Warna bendera kiri",
    "group": "Benteng",
    "kind": "color",
    "control": "color",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "fort-field",
      "side": 0,
      "field": "color"
    },
    "hint": "Warna bendera kiri."
  },
  {
    "id": "fort.codex.color",
    "label": "Benteng · Warna bendera kanan",
    "obj": "fort",
    "plain": "Warna bendera kanan",
    "group": "Benteng",
    "kind": "color",
    "control": "color",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "fort-field",
      "side": 1,
      "field": "color"
    },
    "hint": "Warna bendera kanan."
  },
  {
    "id": "catapult.distance",
    "label": "Katapel · Jarak dari tengah",
    "obj": "catapult",
    "plain": "Jarak dari tengah",
    "group": "Katapel",
    "kind": "number",
    "min": 1.8,
    "max": 2.8,
    "step": 0.1,
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "CAT_X",
      "before": "// benteng kardus",
      "default": 2.4,
      "sites": [["sx*2.4", "sx*CAT_X"], ["x0=(s?2.4:-2.4)", "x0=(s?CAT_X:-CAT_X)"]]
    },
    "hint": "Kedua katapel menjauh atau mendekat dari tengah secara simetris."
  },
  {
    "id": "war.button",
    "label": "Tombol & tagihan · Warna tombol yang berputar",
    "obj": "war",
    "plain": "Warna tombol yang berputar",
    "group": "Tombol & tagihan",
    "kind": "array",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "BCOL"
    },
    "validate": warButtonErr,
    "hint": "Tombol yang berputar saat perang berganti warna mengikuti daftar baru."
  },
  {
    "id": "war.bill",
    "label": "Tombol & tagihan · Jumlah tagihan",
    "obj": "war",
    "plain": "Jumlah tagihan",
    "group": "Tombol & tagihan",
    "kind": "number",
    "min": 0,
    "max": 1000,
    "step": 5,
    "unit": "× Rp10.000",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "num-between",
      "before": "bill=Math.round(",
      "after": "*Math.pow"
    },
    "hint": "Tagihan di papan — 425 berarti Rp4.250.000."
  },
  {
    "id": "war.bill.speed",
    "label": "Tombol & tagihan · Kecepatan tagihan naik",
    "obj": "war",
    "plain": "Kecepatan tagihan naik",
    "group": "Tombol & tagihan",
    "kind": "number",
    "min": 0.5,
    "max": 2,
    "step": 0.1,
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "num-between",
      "before": "Math.pow(s2(3.4,22),",
      "after": ")"
    },
    "hint": "Makin besar, tagihan naik makin cepat selama perang."
  },
  {
    "id": "boss.x",
    "label": "Bos · Geser kiri-kanan",
    "obj": "boss",
    "plain": "Geser kiri-kanan",
    "group": "Bos",
    "kind": "number",
    "min": 28,
    "max": 32,
    "step": 0.1,
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "call",
      "prefix": "boss.position.set(",
      "index": 0
    },
    "hint": "Bos bergeser ke kiri atau ke kanan di dalam ruangannya."
  },
  {
    "id": "boss.scale",
    "label": "Bos · Besar-kecil",
    "obj": "boss",
    "plain": "Besar-kecil",
    "group": "Bos",
    "kind": "number",
    "min": 0.7,
    "max": 1.3,
    "step": 0.05,
    "unit": "×",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "inject-call",
      "after": "const boss=new THREE.Group();",
      "text": "boss.scale.setScalar(1);",
      "prefix": "boss.scale.setScalar(",
      "index": 0,
      "default": 1
    },
    "hint": "Bos membesar atau mengecil."
  },
  {
    "id": "mug.row",
    "label": "Cangkir · Posisi deretan cangkir",
    "obj": "mug",
    "plain": "Posisi deretan cangkir",
    "group": "Cangkir",
    "kind": "number",
    "min": 0.5,
    "max": 2,
    "step": 0.05,
    "files": ["template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "MUG_X",
      "before": "const mugs=",
      "default": 1.1,
      "sites": [
        [
          "const mugs=[mkMug(1.1,.4),mkMug(1.58,.4),mkMug(2.06,.4)]",
          "const mugs=[mkMug(MUG_X,.4),mkMug(MUG_X+MUG_GAP,.4),mkMug(MUG_X+2*MUG_GAP,.4)]"
        ]
      ],
      "also": [
        {
          "name": "MUG_GAP",
          "before": "const mugs=",
          "default": 0.48
        }
      ]
    },
    "hint": "Deretan tiga cangkir bergeser ke kiri atau ke kanan di atas meja."
  },
  {
    "id": "mug.gap",
    "label": "Cangkir · Jarak antar cangkir",
    "obj": "mug",
    "plain": "Jarak antar cangkir",
    "group": "Cangkir",
    "kind": "number",
    "min": 0.3,
    "max": 0.7,
    "step": 0.05,
    "files": ["template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "MUG_GAP",
      "before": "const mugs=",
      "default": 0.48,
      "sites": [
        [
          "const mugs=[mkMug(1.1,.4),mkMug(1.58,.4),mkMug(2.06,.4)]",
          "const mugs=[mkMug(MUG_X,.4),mkMug(MUG_X+MUG_GAP,.4),mkMug(MUG_X+2*MUG_GAP,.4)]"
        ]
      ],
      "also": [
        {
          "name": "MUG_X",
          "before": "const mugs=",
          "default": 1.1
        }
      ]
    },
    "hint": "Jarak antar cangkir merenggang atau merapat."
  },
  {
    "id": "bomb.seconds",
    "label": "Bom · Detik awal hitung mundur",
    "obj": "bomb",
    "plain": "Detik awal hitung mundur",
    "group": "Bom",
    "kind": "number",
    "min": 10,
    "max": 60,
    "step": 1,
    "unit": "detik",
    "files": ["template-bomb.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "CD0",
      "before": "// hitung mundur bom:",
      "default": 30,
      "sites": [
        [
          "const RM=t=>t<2.8?30:Math.max(1,30-Math.floor((t-2.8)*1.4216)),cdS=t=>t>=23.4?'AMAN':'00:'+String(RM(t)).padStart(2,'0');",
          "const RM=t=>t<T_ALARM?CD0:Math.max(1,CD0-Math.floor((t-T_ALARM)*(CD0-1)/(T_DEFUSE-T_ALARM))),cdS=t=>t>=T_DEFUSE?'AMAN':'00:'+String(RM(t)).padStart(2,'0');"
        ]
      ],
      "also": [
        {
          "name": "T_ALARM",
          "before": "function frame(t){",
          "default": 2.8
        },
        {
          "name": "T_DEFUSE",
          "before": "function frame(t){",
          "default": 23.4
        }
      ]
    },
    "hint": "Bom mulai menghitung mundur dari angka ini dan tetap sampai 00:01 saat dijinakkan."
  },
  {
    "id": "typing.windows",
    "label": "Tulisan yang diketik · Waktu mengetik",
    "obj": "typing",
    "plain": "Waktu mengetik",
    "group": "Tulisan yang diketik",
    "kind": "array",
    "control": "windows",
    "files": ["template-bughunter.html", "template-bomb.html", "template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "WIN"
    },
    "validate": typingWindowsErr,
    "hint": "Maskot mengetik pada waktu-waktu ini — pasangan mulai dan selesai."
  },
  {
    "id": "typing.lines",
    "label": "Tulisan yang diketik · Baris yang diketik",
    "obj": "typing",
    "plain": "Baris yang diketik",
    "group": "Tulisan yang diketik",
    "kind": "array",
    "files": ["template-bughunter.html", "template-bomb.html", "template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "whole",
      "name": "TL"
    },
    "validate": typingLinesErr,
    "hint": "Baris yang diketik maskot di layar."
  },
  {
    "id": "meeting.end",
    "label": "Jalan cerita · Waktu rapat selesai",
    "obj": "story",
    "plain": "Waktu rapat selesai",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 10,
    "max": 32,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "MEET_END"
    },
    "hint": "Rapat selesai dan maskot pulang pada waktu ini."
  },
  {
    "id": "beat.debate",
    "label": "Jalan cerita · Waktu mulai debat",
    "obj": "story",
    "plain": "Waktu mulai debat",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 6,
    "max": 12,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-trio.html": {
        "min": 9,
        "max": 15,
        "step": 0.1
      }
    },
    "files": ["template.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_DEBATE",
      "before": "function frame(t){",
      "default": 9,
      "sites": [["ar=s2(9,10.2)", "ar=s2(T_DEBATE,T_DEBATE+1.2)"], ["fe=s2(10.5,11)", "fe=s2(T_DEBATE+1.5,T_DEBATE+2)"]],
      "sitesByFile": {
        "template-trio.html": [["ar=s2(12,13)", "ar=s2(T_DEBATE,T_DEBATE+1)"]]
      }
    },
    "hint": "Debat panas dimulai lebih awal atau lebih lambat."
  },
  {
    "id": "beat.tired",
    "label": "Jalan cerita · Waktu mulai lelah",
    "obj": "story",
    "plain": "Waktu mulai lelah",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 14,
    "max": 19,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-trio.html": {
        "min": 18,
        "max": 23,
        "step": 0.1
      }
    },
    "files": ["template.html", "template-trio.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TIRED",
      "before": "function frame(t){",
      "default": 16.5,
      "defaultByFile": { "template-trio.html": 20.5 },
      "sites": [
        ["*(1-s2(16.5,18))", "*(1-s2(T_TIRED,T_TIRED+1.5))"],
        ["tr=s2(16.5,17.5)", "tr=s2(T_TIRED,T_TIRED+1)"],
        ["*(1-s2(16,16.5))", "*(1-s2(T_TIRED-.5,T_TIRED))"]
      ],
      "sitesByFile": {
        "template-trio.html": [
          ["*(1-s2(20,21))", "*(1-s2(T_TIRED-.5,T_TIRED+.5))"],
          ["tr=s2(20.5,21.5)*(1-s2(23,24))", "tr=s2(T_TIRED,T_TIRED+1)*(1-s2(T_TIRED+2.5,T_TIRED+3.5))"],
          ["q=s2(20.5,22.5)", "q=s2(T_TIRED,T_TIRED+2)"],
          ["t>=22.6?1:0", "t>=T_TIRED+2.1?1:0"]
        ]
      }
    },
    "hint": "Kedua maskot mulai lelah lebih awal atau lebih lambat."
  },
  {
    "id": "beat.tie",
    "label": "Jalan cerita · Waktu seri",
    "obj": "story",
    "plain": "Waktu seri",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 17,
    "max": 21,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-code.html": {
        "min": 21,
        "max": 27,
        "step": 0.1
      }
    },
    "files": ["template.html", "template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TIE",
      "before": "function frame(t){",
      "default": 19,
      "sites": [["q=s2(18,19)", "q=s2(T_TIE-1,T_TIE)"], ["drawBoard(va,vb,t>=19?1:0)", "drawBoard(va,vb,t>=T_TIE?1:0)"]]
    },
    "anchorByFile": {
      "template-code.html": {
        "t": "assign",
        "name": "T_TIE"
      }
    },
    "hint": "Papan menunjukkan hasil seri lebih awal atau lebih lambat."
  },
  {
    "id": "beat.joy",
    "label": "Jalan cerita · Waktu senang",
    "obj": "story",
    "plain": "Waktu senang",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 19,
    "max": 24,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-trio.html": {
        "min": 24,
        "max": 29,
        "step": 0.1
      },
      "template-rival.html": {
        "min": 22,
        "max": 27,
        "step": 0.1
      }
    },
    "files": ["template.html", "template-trio.html", "template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_JOY",
      "before": "function frame(t){",
      "default": 21,
      "defaultByFile": { "template-trio.html": 26, "template-rival.html": 24.6 },
      "sites": [
        ["*(1-s2(20.5,21.5))", "*(1-s2(T_JOY-.5,T_JOY+.5))"],
        ["jy=s2(21,22)", "jy=s2(T_JOY,T_JOY+1)"],
        ["6.2832*s2(21.6,23.2)", "6.2832*s2(T_JOY+.6,T_JOY+2.2)"],
        ["(t>=21&&t<25.8)", "(t>=T_JOY&&t<T_JOY+4.8)"]
      ],
      "sitesByFile": {
        "template-trio.html": [
          ["jy=s2(26,27)", "jy=s2(T_JOY,T_JOY+1)"],
          ["6.2832*s2(26.6,28.2)", "6.2832*s2(T_JOY+.6,T_JOY+2.2)"],
          ["(t>=26.3&&t<30.3)", "(t>=T_JOY+.3&&t<T_JOY+4.3)"]
        ],
        "template-rival.html": [
          ["jy=s2(24.6,25.1)", "jy=s2(T_JOY,T_JOY+.5)"],
          ["t<25?2", "t<T_JOY+.4?2"],
          ["(t>=24.6&&t<28.6)", "(t>=T_JOY&&t<T_JOY+4)"]
        ]
      }
    },
    "hint": "Para maskot bersorak dan berputar lebih awal atau lebih lambat."
  },
  {
    "id": "beat.board",
    "label": "Jalan cerita · Waktu papan masuk",
    "obj": "story",
    "plain": "Waktu papan masuk",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 1,
    "max": 6,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "T_BOARD"
    },
    "hint": "Papan skor masuk lebih awal atau lebih lambat."
  },
  {
    "id": "beat.refactor",
    "label": "Jalan cerita · Waktu mengetik ulang",
    "obj": "story",
    "plain": "Waktu mengetik ulang",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 7,
    "max": 12,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "T_REF"
    },
    "hint": "Maskot oranye mulai menulis ulang kodenya lebih awal atau lebih lambat."
  },
  {
    "id": "beat.bug",
    "label": "Jalan cerita · Waktu galat muncul",
    "obj": "story",
    "plain": "Waktu galat muncul",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 13,
    "max": 18,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-code.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign-sites",
      "name": "T_BUG",
      "sites": [["s2(T_BUG,16.6)", "s2(T_BUG,T_BUG+1)"], ["s2(15.2,15.6)", "s2(T_BUG-.4,T_BUG)"]]
    },
    "hint": "Galat merah muncul di kedua layar lebih awal atau lebih lambat."
  },
  {
    "id": "beat.fix",
    "label": "Jalan cerita · Waktu perbaikan",
    "obj": "story",
    "plain": "Waktu perbaikan",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 19,
    "max": 24,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-deploy.html": {
        "min": 10,
        "max": 14,
        "step": 0.1
      }
    },
    "files": ["template-code.html", "template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "T_FIX"
    },
    "anchorByFile": {
      "template-deploy.html": {
        "t": "const-sites",
        "name": "T_FIX",
        "before": "function frame(t){",
        "default": 12.3,
        "sites": [["+s2(12.2,12.6)", "+s2(T_FIX-.1,T_FIX+.3)"], ["+s2(11.6,12.4)", "+s2(T_FIX-.7,T_FIX+.1)"]]
      }
    },
    "hint": "Perbaikan hijau muncul lebih awal atau lebih lambat."
  },
  {
    "id": "beat.empty",
    "label": "Jalan cerita · Waktu kuota habis",
    "obj": "story",
    "plain": "Waktu kuota habis",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 13,
    "max": 18,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_EMPTY",
      "before": "function frame(t){",
      "default": 15.2,
      "sites": [
        ["*(1-s2(15.2,15.8))", "*(1-s2(T_EMPTY,T_EMPTY+.6))"],
        ["al=s2(15.2,15.6)", "al=s2(T_EMPTY,T_EMPTY+.4)"],
        ["t<15.2?0", "t<T_EMPTY?0"],
        ["t>=15.2?Math.max", "t>=T_EMPTY?Math.max"],
        ["(t-15.2)/.5", "(t-T_EMPTY)/.5"]
      ]
    },
    "hint": "Alarm kuota habis berbunyi lebih awal atau lebih lambat."
  },
  {
    "id": "beat.frugal",
    "label": "Jalan cerita · Waktu mulai hemat",
    "obj": "story",
    "plain": "Waktu mulai hemat",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 18,
    "max": 23,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_FRUGAL",
      "before": "function frame(t){",
      "default": 20.8,
      "sites": [
        ["ty=s2(20.8,21.3)", "ty=s2(T_FRUGAL,T_FRUGAL+.5)"],
        ["(t>=20.8&&t<27)", "(t>=T_FRUGAL&&t<T_RESET)"],
        ["t<20.6?1", "t<T_FRUGAL-.2?1"],
        ["s2(20.8,24.4)", "s2(T_FRUGAL,T_FRUGAL+3.6)"]
      ],
      "also": [
        {
          "name": "T_RESET",
          "before": "function frame(t){",
          "default": 27
        }
      ]
    },
    "hint": "Kedua maskot mulai berhemat lebih awal atau lebih lambat."
  },
  {
    "id": "beat.reset",
    "label": "Jalan cerita · Waktu isi ulang",
    "obj": "story",
    "plain": "Waktu isi ulang",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 25,
    "max": 29,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-kuota.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_RESET",
      "before": "function frame(t){",
      "default": 27,
      "sites": [
        ["*(1-s2(27,27.6))", "*(1-s2(T_RESET,T_RESET+.6))"],
        ["(t>=27&&t<29)", "(t>=T_RESET&&t<T_RESET+2)"],
        ["rf=pop(27,28.8)", "rf=pop(T_RESET,T_RESET+1.8)"],
        ["t<27.7?3", "t<T_RESET+.7?3"]
      ]
    },
    "hint": "Kuota diisi ulang dan papan menyala hijau lebih awal atau lebih lambat."
  },
  {
    "id": "beat.relapse",
    "label": "Jalan cerita · Waktu kuota habis lagi",
    "obj": "story",
    "plain": "Waktu kuota habis lagi",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 29,
    "max": 33,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-rival.html": {
        "min": 27,
        "max": 32,
        "step": 0.1
      }
    },
    "files": ["template-kuota.html", "template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_RELAPSE",
      "before": "function frame(t){",
      "default": 31,
      "sites": [
        ["+s2(31,31.4)", "+s2(T_RELAPSE,T_RELAPSE+.4)"],
        ["t<31?0:1", "t<T_RELAPSE?0:1"],
        ["t>=31?Math.max", "t>=T_RELAPSE?Math.max"]
      ],
      "sitesByFile": {
        "template-rival.html": [
          ["s2(29.2,29.9)", "s2(T_RELAPSE,T_RELAPSE+.7)"],
          ["+s2(27.8,28.3)", "+s2(T_RELAPSE-1.4,T_RELAPSE-.9)"],
          ["t<29.4?3", "t<T_RELAPSE+.2?3"],
          ["s2(29.2,31.2)", "s2(T_RELAPSE,T_RELAPSE+2)"]
        ]
      }
    },
    "hint": "Kuota habis untuk kedua kalinya — atau kedua maskot musuhan lagi — lebih awal atau lebih lambat."
  },
  {
    "id": "beat.alert",
    "label": "Jalan cerita · Waktu waspada",
    "obj": "story",
    "plain": "Waktu waspada",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 13,
    "max": 18,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_ALERT",
      "before": "function frame(t){",
      "default": 15.2,
      "sites": [
        ["al=s2(15.2,15.6)", "al=s2(T_ALERT,T_ALERT+.4)"],
        ["t<15.2?0", "t<T_ALERT?0"],
        ["t>=15.2?Math.max", "t>=T_ALERT?Math.max"],
        ["(t-15.2)/.5", "(t-T_ALERT)/.5"],
        ["*(1-s2(16.5,19.5))", "*(1-s2(T_ALERT+1.3,T_ALERT+4.3))"]
      ]
    },
    "hint": "Kedua maskot mulai waspada lebih awal atau lebih lambat."
  },
  {
    "id": "beat.teamwork",
    "label": "Jalan cerita · Waktu kerja sama",
    "obj": "story",
    "plain": "Waktu kerja sama",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 18,
    "max": 23,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-rival.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TEAM",
      "before": "function frame(t){",
      "default": 20.8,
      "sites": [
        ["ty=s2(20.8,21.3)", "ty=s2(T_TEAM,T_TEAM+.5)"],
        ["t<20.6?1", "t<T_TEAM-.2?1"],
        ["s2(20.8,24.4)", "s2(T_TEAM,T_TEAM+3.6)"],
        ["(t>=20.8&&t<29)", "(t>=T_TEAM&&t<T_RELAPSE)"]
      ],
      "also": [
        {
          "name": "T_RELAPSE",
          "before": "function frame(t){",
          "default": 29.2
        }
      ]
    },
    "hint": "Kedua maskot mulai bekerja sama lebih awal atau lebih lambat."
  },
  {
    "id": "beat.war",
    "label": "Jalan cerita · Waktu perang mulai",
    "obj": "story",
    "plain": "Waktu perang mulai",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 10,
    "max": 15,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_WAR",
      "before": "function frame(t){",
      "default": 12.8,
      "sites": [
        ["war:s2(12.8,13.4)", "war:s2(T_WAR,T_WAR+.6)"],
        ["mar:s2(12.6,14.6)", "mar:s2(T_WAR-.2,T_WAR+1.8)"],
        ["mr=s2(12.6+.1*i,14.4+.1*i)", "mr=s2(T_WAR-.2+.1*i,T_WAR+1.6+.1*i)"],
        ["(t>=12.8&&t<20.8)", "(t>=T_WAR&&t<T_TRUCE)"]
      ],
      "also": [
        {
          "name": "T_TRUCE",
          "before": "function frame(t){",
          "default": 20.8
        }
      ]
    },
    "hint": "Perang dimulai lebih awal atau lebih lambat."
  },
  {
    "id": "beat.truce",
    "label": "Jalan cerita · Waktu gencatan",
    "obj": "story",
    "plain": "Waktu gencatan",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 18,
    "max": 23,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TRUCE",
      "before": "function frame(t){",
      "default": 20.8,
      "sites": [
        ["*(1-s2(20.4,21))", "*(1-s2(T_TRUCE-.4,T_TRUCE+.2))"],
        ["ko:s2(19.4,20)*(1-s2(21.6,22.4))", "ko:s2(T_TRUCE-1.4,T_TRUCE-.8)*(1-s2(T_TRUCE+.8,T_TRUCE+1.6))"],
        ["fl:pop(20.8,23.4)", "fl:pop(T_TRUCE,T_TRUCE+2.6)"],
        ["s2(22.4,23.6)", "s2(T_TRUCE+1.6,T_TRUCE+2.8)"],
        ["(t>=20.8&&t<25)", "(t>=T_TRUCE&&t<T_TRUCE+4.2)"]
      ]
    },
    "hint": "Perang berhenti dan bendera putih berkibar lebih awal atau lebih lambat."
  },
  {
    "id": "beat.intern",
    "label": "Jalan cerita · Waktu magang masuk",
    "obj": "story",
    "plain": "Waktu magang masuk",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 21,
    "max": 26,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_INTERN",
      "before": "function frame(t){",
      "default": 23.6,
      "sites": [
        ["s2(22.6,23.2)", "s2(T_INTERN-1,T_INTERN-.4)"],
        ["*(1-s2(24.2,24.8))", "*(1-s2(T_INTERN+.6,T_INTERN+1.2))"],
        ["iv=s2(23.6,24.1)", "iv=s2(T_INTERN,T_INTERN+.5)"],
        ["iw=s2(23.8,24.8)", "iw=s2(T_INTERN+.2,T_INTERN+1.2)"],
        ["pa=s2(24.8,25.2)", "pa=s2(T_INTERN+1.2,T_INTERN+1.6)"],
        ["ex=s2(26.2,27.2)", "ex=s2(T_INTERN+2.6,T_INTERN+3.6)"],
        ["t>=25?'TOMBOL: BIRU ✓'", "t>=T_INTERN+1.4?'TOMBOL: BIRU ✓'"]
      ]
    },
    "hint": "Magang masuk dan menekan tombol lebih awal atau lebih lambat."
  },
  {
    "id": "beat.punch",
    "label": "Jalan cerita · Waktu pukulan pertama",
    "obj": "story",
    "plain": "Waktu pukulan pertama",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 14,
    "max": 16,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "FT0"
    },
    "hint": "Pukulan pertama mendarat lebih awal atau lebih lambat."
  },
  {
    "id": "beat.punch.gap",
    "label": "Jalan cerita · Jarak antar pukulan",
    "obj": "story",
    "plain": "Jarak antar pukulan",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 0.8,
    "max": 1.6,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-perang.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "assign",
      "name": "P"
    },
    "hint": "Pukulan-pukulan berikutnya datang lebih rapat atau lebih renggang."
  },
  {
    "id": "beat.typing",
    "label": "Jalan cerita · Waktu mulai mengetik",
    "obj": "story",
    "plain": "Waktu mulai mengetik",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 1,
    "max": 5,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-typing.html", "template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TYPE",
      "before": "function frame(t){",
      "default": 3,
      "sites": [
        ["sm(cl((t-3)/.5,0,1))", "sm(cl((t-T_TYPE)/.5,0,1))"],
        ["Math.sin((t-3)*1.1)", "Math.sin((t-T_TYPE)*1.1)"],
        ["p=t<3?0:t<15?(t-3)/12*100:100", "p=t<T_TYPE?0:t<T_DONE?(t-T_TYPE)/(T_DONE-T_TYPE)*100:100"],
        ["happy=t<3||t>=15", "happy=t<T_TYPE||t>=T_DONE"],
        ["if(t<3)", "if(t<T_TYPE)"],
        ["(t-2.4)", "(t-(T_TYPE-.6))"],
        ["sm(cl((t-2.6)/1,0,1))", "sm(cl((t-(T_TYPE-.4))/1,0,1))"],
        ["1-sm(cl((t-2.6)/.6,0,1))", "1-sm(cl((t-(T_TYPE-.4))/.6,0,1))"]
      ],
      "also": [
        {
          "name": "T_DONE",
          "before": "function frame(t){",
          "default": 15
        }
      ],
      "sitesByFile": {
        "template-deploy.html": [
          ["(t<10?3.3:12.3)", "(t<10?T_TYPE+.3:T_FIX)"],
          ["sw=s2(3,3.5)", "sw=s2(T_TYPE,T_TYPE+.5)"],
          ["fm=s2(2.6,3.6)", "fm=s2(T_TYPE-.4,T_TYPE+.6)"],
          ["sy=Math.sin((t-3)*1.1)", "sy=Math.sin((t-T_TYPE)*1.1)"],
          ["hF=1-s2(2.6,3.2)", "hF=1-s2(T_TYPE-.4,T_TYPE+.2)"],
          ["s2(2.4,3)", "s2(T_TYPE-.6,T_TYPE)"]
        ]
      }
    },
    "anchorByFile": {
      "template-deploy.html": {
        "t": "const-sites",
        "name": "T_TYPE",
        "before": "function frame(t){",
        "default": 3,
        "sites": [
          ["(t<10?3.3:12.3)", "(t<10?T_TYPE+.3:T_FIX)"],
          ["sw=s2(3,3.5)", "sw=s2(T_TYPE,T_TYPE+.5)"],
          ["fm=s2(2.6,3.6)", "fm=s2(T_TYPE-.4,T_TYPE+.6)"],
          ["sy=Math.sin((t-3)*1.1)", "sy=Math.sin((t-T_TYPE)*1.1)"],
          ["hF=1-s2(2.6,3.2)", "hF=1-s2(T_TYPE-.4,T_TYPE+.2)"],
          ["s2(2.4,3)", "s2(T_TYPE-.6,T_TYPE)"]
        ],
        "also": [
          {
            "name": "T_FIX",
            "before": "function frame(t){",
            "default": 12.3
          }
        ]
      }
    },
    "hint": "Maskot mulai mengetik lebih awal atau lebih lambat."
  },
  {
    "id": "beat.done",
    "label": "Jalan cerita · Waktu selesai",
    "obj": "story",
    "plain": "Waktu selesai",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 12,
    "max": 18,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-deploy.html": {
        "min": 16,
        "max": 21,
        "step": 0.1
      }
    },
    "files": ["template-typing.html", "template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_DONE",
      "before": "function frame(t){",
      "default": 15,
      "defaultByFile": { "template-deploy.html": 18.4 },
      "sites": [
        ["*(1-sm(cl((t-14.5)/.5,0,1)))", "*(1-sm(cl((t-(T_DONE-.5))/.5,0,1)))"],
        ["cel=t>=15&&t<19", "cel=t>=T_DONE&&t<T_DONE+4"],
        ["else if(t<15)", "else if(t<T_DONE)"],
        ["(t-15)*5", "(t-T_DONE)*5"],
        ["(t-17.8)", "(t-(T_DONE+2.8))"],
        ["(t-19)", "(t-(T_DONE+4))"],
        ["sm(cl((t-14.4)/1.2,0,1))", "sm(cl((t-(T_DONE-.6))/1.2,0,1))"],
        ["sm(cl((t-16)/1.6,0,1))", "sm(cl((t-(T_DONE+1))/1.6,0,1))"],
        ["sm(cl((t-14.6)/.6,0,1))", "sm(cl((t-(T_DONE-.4))/.6,0,1))"],
        ["t>=15&&t<19.2", "t>=T_DONE&&t<T_DONE+4.2"]
      ],
      "sitesByFile": {
        "template-deploy.html": [
          ["PD.push(18.4+Math.pow(u,1.5)*2.6)", "PD.push(T_DONE+Math.pow(u,1.5)*2.6)"],
          ["ts<21.4?", "ts<T_DONE+3?"],
          ["(ts-18.4)*5", "(ts-T_DONE)*5"],
          ["cel=s2(18.4,18.8)*(1-s2(22.4,23))", "cel=s2(T_DONE,T_DONE+.4)*(1-s2(T_DONE+4,T_DONE+4.6))"],
          ["+s2(18.4,19)", "+s2(T_DONE,T_DONE+.6)"],
          ["*(1-s2(17.4,18.2))", "*(1-s2(T_DONE-1,T_DONE-.2))"],
          ["(t-18.4)*5", "(t-T_DONE)*5"],
          ["(1-s2(21,22.4))", "(1-s2(T_DONE+2.6,T_DONE+4))"],
          ["s2(18.8,20.4)", "s2(T_DONE+.4,T_DONE+2)"],
          ["s2(18.4,18.8)*(1-s2(22.4,23))", "s2(T_DONE,T_DONE+.4)*(1-s2(T_DONE+4,T_DONE+4.6))"],
          ["t>=18.4&&t<22.6", "t>=T_DONE&&t<T_DONE+4.2"]
        ]
      }
    },
    "hint": "Kode selesai dan maskot bersorak lebih awal atau lebih lambat."
  },
  {
    "id": "beat.panic",
    "label": "Jalan cerita · Waktu panik",
    "obj": "story",
    "plain": "Waktu panik",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 7,
    "max": 11,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-deploy.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_PANIC",
      "before": "function frame(t){",
      "default": 9,
      "sites": [
        ["pa=s2(9,9.5)*(1-s2(11.8,12.4))", "pa=s2(T_PANIC,T_PANIC+.5)*(1-s2(T_PANIC+2.8,T_PANIC+3.4))"],
        ["*(1-s2(8.6,9.4))", "*(1-s2(T_PANIC-.4,T_PANIC+.4))"]
      ]
    },
    "hint": "Maskot panik saat galat muncul lebih awal atau lebih lambat."
  },
  {
    "id": "beat.alarm",
    "label": "Jalan cerita · Waktu alarm",
    "obj": "story",
    "plain": "Waktu alarm",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 1,
    "max": 4,
    "step": 0.1,
    "unit": "detik",
    "rangeByFile": {
      "template-bomb.html": {
        "min": 1,
        "max": 5,
        "step": 0.1
      }
    },
    "files": ["template-bughunter.html", "template-bomb.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_ALARM",
      "before": "function frame(t){",
      "default": 2,
      "sites": [
        ["ss(t,2,3)", "ss(t,T_ALARM,T_ALARM+1)"],
        ["ss(t,2,2.4)", "ss(t,T_ALARM,T_ALARM+.4)"],
        ["if(t<2)", "if(t<T_ALARM)"],
        ["ss(t,2.4,3)", "ss(t,T_ALARM+.4,T_ALARM+1)"],
        ["(t-2)/.7", "(t-T_ALARM)/.7"],
        ["s2(2,2.4)", "s2(T_ALARM,T_ALARM+.4)"],
        ["1-s2(1.8,2.2)", "1-s2(T_ALARM-.2,T_ALARM+.2)"],
        ["(t>2&&t<2.57)", "(t>T_ALARM&&t<T_ALARM+.57)"],
        ["(t-2)/.57", "(t-T_ALARM)/.57"],
        ["t<2.2?1:0", "t<T_ALARM+.2?1:0"]
      ],
      "sitesByFile": {
        "template-bomb.html": [
          ["ss(t,2.8,3.2)", "ss(t,T_ALARM,T_ALARM+.4)"],
          ["t>=2.8&&t<18.6", "t>=T_ALARM&&t<18.6"],
          ["t>=2.8?RED", "t>=T_ALARM?RED"],
          ["if(t>=2.8)", "if(t>=T_ALARM)"],
          ["t<2.8?'SIAP'", "t<T_ALARM?'SIAP'"],
          ["const L=t<2.8?", "const L=t<T_ALARM?"],
          ["t<2.8?['", "t<T_ALARM?['"],
          ["t>=2.8&&t<13", "t>=T_ALARM&&t<13"],
          ["t>=2.8?Math.max", "t>=T_ALARM?Math.max"],
          ["(t-2.8)/.7", "(t-T_ALARM)/.7"],
          ["(t>2.8&&t<3.37)", "(t>T_ALARM&&t<T_ALARM+.57)"],
          ["(t-2.8)/.57", "(t-T_ALARM)/.57"],
          ["s2(2.8,3.1)", "s2(T_ALARM,T_ALARM+.3)"],
          ["t<2.8?1:0", "t<T_ALARM?1:0"]
        ]
      }
    },
    "hint": "Alarm berbunyi dan layar memerah lebih awal atau lebih lambat."
  },
  {
    "id": "beat.squash",
    "label": "Jalan cerita · Waktu bug dihancurkan",
    "obj": "story",
    "plain": "Waktu bug dihancurkan",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 20,
    "max": 27,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-bughunter.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_SQUASH",
      "before": "function frame(t){",
      "default": 23.4,
      "sites": [
        ["ss(t,23.4,24.8)", "ss(t,T_SQUASH,T_SQUASH+1.4)"],
        ["Math.min(t,23.4)/23.4*227", "Math.min(t,T_SQUASH)/T_SQUASH*227"],
        ["Math.min(t,23.4)", "Math.min(t,T_SQUASH)"],
        ["ss(t,23.4,23.9)", "ss(t,T_SQUASH,T_SQUASH+.5)"],
        ["if(t>=23.4)", "if(t>=T_SQUASH)"],
        ["t>=23.4?'PULIH'", "t>=T_SQUASH?'PULIH'"],
        ["(1-ss(t,23.8,24.6))", "(1-ss(t,T_SQUASH+.4,T_SQUASH+1.2))"],
        ["ss(t,23.4,23.7)", "ss(t,T_SQUASH,T_SQUASH+.3)"],
        ["(1-ss(t,23.4,23.7))", "(1-ss(t,T_SQUASH,T_SQUASH+.3))"],
        ["if(t>=23.4&&t<24.4)", "if(t>=T_SQUASH&&t<T_SQUASH+1)"],
        ["(t-23.4)/1", "(t-T_SQUASH)/1"],
        ["t>=23.4?Math.max(0,1-(t-23.4)/.5):0", "t>=T_SQUASH?Math.max(0,1-(t-T_SQUASH)/.5):0"],
        ["t>=23.4?Math.max", "t>=T_SQUASH?Math.max"],
        ["(t-23.4)/.4", "(t-T_SQUASH)/.4"],
        ["23.4+Math.pow(u,1.5)*2.6", "T_SQUASH+Math.pow(u,1.5)*2.6"],
        ["(ts-23.4)*5", "(ts-T_SQUASH)*5"],
        ["(1-s2(22.6,23.4))", "(1-s2(T_SQUASH-.8,T_SQUASH))"],
        ["(1-s2(23.4,23.9))", "(1-s2(T_SQUASH,T_SQUASH+.5))"],
        ["s2(23.4,23.8)", "s2(T_SQUASH,T_SQUASH+.4)"],
        ["s2(23.6,27)", "s2(T_SQUASH+.2,T_SQUASH+3.6)"],
        ["(t-23.4)*5", "(t-T_SQUASH)*5"],
        ["t>=23.4&&t<27.6", "t>=T_SQUASH&&t<T_SQUASH+4.2"],
        ["Math.min(t,23.4)/23.4*227", "Math.min(t,T_SQUASH)/T_SQUASH*227"]
      ]
    },
    "hint": "Bug dihancurkan dan layar pulih lebih awal atau lebih lambat."
  },
  {
    "id": "beat.defuse",
    "label": "Jalan cerita · Waktu bom jinak",
    "obj": "story",
    "plain": "Waktu bom jinak",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 20,
    "max": 27,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-bomb.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_DEFUSE",
      "before": "function frame(t){",
      "default": 23.4,
      "sites": [
        ["(1-ss(t,23.2,23.6))", "(1-ss(t,T_DEFUSE-.2,T_DEFUSE+.2))"],
        ["t>=23.4?GRN", "t>=T_DEFUSE?GRN"],
        ["if(t>=23.4)", "if(t>=T_DEFUSE)"],
        ["t<23.4?", "t<T_DEFUSE?"],
        ["t<21.9?", "t<T_DEFUSE-1.5?"],
        ["t>=23.4?Math.max", "t>=T_DEFUSE?Math.max"],
        ["(t-23.4)/.4", "(t-T_DEFUSE)/.4"],
        ["23.4+Math.pow(u,1.5)*2.6", "T_DEFUSE+Math.pow(u,1.5)*2.6"],
        ["(ts-23.4)*5", "(ts-T_DEFUSE)*5"],
        ["(1-s2(22.6,23.4))", "(1-s2(T_DEFUSE-.8,T_DEFUSE))"],
        ["(1-s2(23.2,23.6))", "(1-s2(T_DEFUSE-.2,T_DEFUSE+.2))"],
        ["s2(23.4,23.9)", "s2(T_DEFUSE,T_DEFUSE+.5)"],
        ["s2(23.4,23.8)", "s2(T_DEFUSE,T_DEFUSE+.4)"],
        ["s2(23.6,27)", "s2(T_DEFUSE+.2,T_DEFUSE+3.6)"],
        ["(t-23.4)*5", "(t-T_DEFUSE)*5"],
        ["t>=23.4&&t<27.6", "t>=T_DEFUSE&&t<T_DEFUSE+4.2"],
        ["s2(23.9,24.2)", "s2(T_DEFUSE+.5,T_DEFUSE+.8)"],
        ["1-s2(23.9,24.4)", "1-s2(T_DEFUSE+.5,T_DEFUSE+1)"],
        ["(t-23.4)/.5", "(t-T_DEFUSE)/.5"]
      ]
    },
    "hint": "Bom dijinakkan dan layar berubah hijau lebih awal atau lebih lambat."
  },
  {
    "id": "beat.twist",
    "label": "Jalan cerita · Waktu kejutan",
    "obj": "story",
    "plain": "Waktu kejutan",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 26,
    "max": 31,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-meeting.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_TWIST",
      "before": "function frame(t){",
      "default": 28.4,
      "sites": [
        ["ss(t,28.2,28.6)", "ss(t,T_TWIST-.2,T_TWIST+.2)"],
        ["*(1-s2(28,28.4))", "*(1-s2(T_TWIST-.4,T_TWIST))"],
        ["tw=s2(28.4,28.8)", "tw=s2(T_TWIST,T_TWIST+.4)"],
        ["drawNote(t>=28.4?'besok':'lima')", "drawNote(t>=T_TWIST?'besok':'lima')"]
      ]
    },
    "hint": "Kejutan “lanjut besok” muncul lebih awal atau lebih lambat."
  },
  {
    "id": "beat.wake",
    "label": "Jalan cerita · Waktu bangun",
    "obj": "story",
    "plain": "Waktu bangun",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 10,
    "max": 14,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_WAKE",
      "before": "function frame(t){",
      "default": 12,
      "sites": [
        ["t<12?'z'", "t<T_WAKE?'z'"],
        ["s=1-s2(12,12.6)", "s=1-s2(T_WAKE,T_WAKE+.6)"],
        ["st=s2(12,12.2)*(1-s2(13.8,14))", "st=s2(T_WAKE,T_WAKE+.2)*(1-s2(T_WAKE+1.8,T_WAKE+2))"],
        ["*(1-s2(11.6,12))", "*(1-s2(T_WAKE-.4,T_WAKE))"],
        ["(t>=12&&t<14", "(t>=T_WAKE&&t<T_WAKE+2"],
        ["(t-12)*6", "(t-T_WAKE)*6"],
        ["s2(12.8,13.4)", "s2(T_WAKE+.8,T_WAKE+1.4)"],
        ["s2(13.6,14)", "s2(T_WAKE+1.6,T_WAKE+2)"],
        ["pop(12,13.6)", "pop(T_WAKE,T_WAKE+1.6)"]
      ]
    },
    "hint": "Maskot bangun dari tidur lebih awal atau lebih lambat."
  },
  {
    "id": "beat.work",
    "label": "Jalan cerita · Waktu mulai kerja",
    "obj": "story",
    "plain": "Waktu mulai kerja",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 12,
    "max": 16,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_WORK",
      "before": "function frame(t){",
      "default": 14,
      "sites": [
        ["wk=s2(14,14.5)", "wk=s2(T_WORK,T_WORK+.5)"],
        ["t>=14&&t<22", "t>=T_WORK&&t<T_END"],
        ["Math.sin((t-14)*Math.PI/2)", "Math.sin((t-T_WORK)*Math.PI/2)"],
        ["t<14?0:t<22?(t-14)/8*100:100", "t<T_WORK?0:t<T_END?(t-T_WORK)/(T_END-T_WORK)*100:100"],
        ["sm(cl((t-13.5)/.5,0,1))", "sm(cl((t-(T_WORK-.5))/.5,0,1))"]
      ],
      "also": [
        {
          "name": "T_END",
          "before": "function frame(t){",
          "default": 22
        }
      ]
    },
    "hint": "Maskot mulai bekerja lebih awal atau lebih lambat."
  },
  {
    "id": "beat.work.end",
    "label": "Jalan cerita · Waktu selesai kerja",
    "obj": "story",
    "plain": "Waktu selesai kerja",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 18,
    "max": 26,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_END",
      "before": "function frame(t){",
      "default": 22,
      "sites": [
        ["*(1-s2(21.5,22))", "*(1-s2(T_END-.5,T_END))"],
        ["hpy=s2(22,22.5)*(1-s2(24.7,25.2))", "hpy=s2(T_END,T_END+.5)*(1-s2(T_END+2.7,T_END+3.2))"],
        ["(t>=22&&t<25", "(t>=T_END&&t<T_END+3"],
        ["(t-22)*5", "(t-T_END)*5"],
        ["s2(24.2,25)", "s2(T_END+2.2,T_END+3)"],
        ["parts.visible=t>=22&&t<26.2", "parts.visible=t>=T_END&&t<T_END+4.2"]
      ]
    },
    "hint": "Maskot selesai bekerja dan bersorak lebih awal atau lebih lambat."
  },
  {
    "id": "beat.sleep",
    "label": "Jalan cerita · Waktu tidur lagi",
    "obj": "story",
    "plain": "Waktu tidur lagi",
    "group": "Jalan cerita",
    "kind": "number",
    "min": 26,
    "max": 31,
    "step": 0.1,
    "unit": "detik",
    "files": ["template-sleep.html"],
    "unavailableReason": "Tidak ada di video ini.",
    "anchor": {
      "t": "const-sites",
      "name": "T_SLEEP",
      "before": "function frame(t){",
      "default": 28,
      "sites": [
        ["+s2(28,29.5)", "+s2(T_SLEEP,T_SLEEP+1.5)"],
        ["*(1-s2(27.6,28))", "*(1-s2(T_SLEEP-.4,T_SLEEP))"],
        ["-.25*sm(cl((t-27)/1,0,1))", "-.25*sm(cl((t-(T_SLEEP-1))/1,0,1))"]
      ]
    },
    "hint": "Maskot kembali tidur lebih awal atau lebih lambat."
  },
];

/** Validator nilai untuk def array/teks. Kembalikan pesan error (diawali
 *  id pengaturan, supaya UI bisa menaruhnya di baris yang benar) atau null.
 *  Pesan memakai bahasa sehari-hari, tanpa istilah dalam. */
export function boardScoreErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length !== 3) return `${id}: harus 3 angka.`;
  for (const n of v) if (!Number.isInteger(n) || n < 0 || n > 100) return `${id}: tiap angka harus bilangan bulat 0..100 (dapat ${JSON.stringify(v)}).`;
  return null;
}
export function tankCurveErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length < 2) return `${id}: harus daftar [detik, persen] minimal 2 baris.`;
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 2 || !isNum(r[0]) || !isNum(r[1])) return `${id} baris ${i + 1}: harus [detik, persen].`;
    if (r[0] < 0) return `${id} baris ${i + 1}: detik ${r[0]} kurang dari 0.`;
    if (r[0] <= prev) return `${id} baris ${i + 1}: detik harus naik terus.`;
    if (r[1] < 0 || r[1] > 100) return `${id} baris ${i + 1}: persen ${r[1]} di luar 0..100.`;
    if (i === 0 && r[0] !== 0) return `${id}: baris pertama harus detik 0 (tangki mulai penuh).`;
    prev = r[0];
  }
  return null;
}
export function rivalNotesErr(v, ctx, id) {
  if (!Array.isArray(v)) return `${id}: harus daftar catatan.`;
  let prevA = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const n = v[i];
    if (!n || typeof n !== "object") return `${id} catatan ${i + 1}: isinya tidak lengkap.`;
    if (n.f !== 0 && n.f !== 1) return `${id} catatan ${i + 1}: pengirim harus maskot oranye atau biru.`;
    if (!Array.isArray(n.to) || n.to.length !== 2 || !n.to.every(isNum)) return `${id} catatan ${i + 1}: tujuan harus [kiri-kanan, tinggi].`;
    if (!isNum(n.a) || !isNum(n.b) || !(0 <= (n.a) && (n.a) < (n.b) && (n.b) <= ctx.len)) return `${id} catatan ${i + 1}: waktunya harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
    if ((n.a) < prevA) return `${id} catatan ${i + 1}: waktu mulai harus naik terus.`;
    if (!isNum(n.o) || !((n.o) === 99 || (n.o) >= (n.b))) return `${id} catatan ${i + 1}: waktu sobek harus sesudah selesai, atau 99 (= tidak pernah sobek).`;
    if (!isNum(n.r)) return `${id} catatan ${i + 1}: putaran harus angka.`;
    if (!Array.isArray(n.tx) || n.tx.length < 1 || n.tx.length > 2 || !n.tx.every((s) => typeof s === "string" && s.length >= 1 && s.length <= 14)) return `${id} catatan ${i + 1}: tulisannya harus 1-2 baris, tiap baris 1..14 huruf.`;
    prevA = n.a;
  }
  return null;
}
export function warSpawnsErr(v, ctx, id) {
  if (!Array.isArray(v) || v.length !== 2) return `${id}: harus dua daftar waktu (satu per pihak).`;
  for (let s = 0; s < 2; s++) {
    const row = v[s];
    if (!Array.isArray(row) || row.length < 1 || row.length > 8) return `${id} pihak ${s + 1}: harus 1..8 waktu muncul.`;
    let prev = -Infinity;
    for (const t of row) {
      if (!isNum(t) || t < 0 || t > ctx.len) return `${id} pihak ${s + 1}: waktu ${t} di luar 0..durasi video (${ctx.len} detik).`;
      if ((t) <= prev) return `${id} pihak ${s + 1}: waktu harus naik terus.`;
      prev = t;
    }
  }
  return null;
}
export function warCatapultsErr(v, ctx, id) {
  if (!Array.isArray(v)) return `${id}: harus daftar tembakan.`;
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 6 || !r.every(isNum)) return `${id} tembakan ${i + 1}: harus 6 angka.`;
    if (r[0] !== 0 && r[0] !== 1) return `${id} tembakan ${i + 1}: pihak harus maskot oranye atau biru.`;
    if (r[1] < 0 || r[1] > ctx.len) return `${id} tembakan ${i + 1}: waktu mulai ${r[1]} di luar 0..durasi video (${ctx.len} detik).`;
    if ((r[1]) <= prev) return `${id} tembakan ${i + 1}: waktu mulai harus naik terus.`;
    prev = r[1];
  }
  return null;
}
export function typingWindowsErr(v, ctx, id) {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar [mulai, selesai] yang tidak kosong.`;
  let prevEnd = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const w = v[i];
    if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `${id} baris ${i + 1}: harus [mulai, selesai].`;
    if (!(0 <= (w[0]) && (w[0]) < (w[1]) && (w[1]) <= ctx.len)) return `${id} baris ${i + 1}: harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
    if ((w[0]) < prevEnd) return `${id} baris ${i + 1}: waktunya tumpang tindih dengan baris sebelumnya.`;
    prevEnd = w[1];
  }
  return null;
}
export function typingLinesErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar baris ketikan yang tidak kosong.`;
  for (let i = 0; i < v.length; i++) {
    const row = v[i];
    if (!Array.isArray(row) || row.length < 1 || row.length > 4) return `${id} baris ${i + 1}: harus 1..4 baris teks.`;
    for (const s of row) {
      if (typeof s !== "string" || !s.length || s.length > 200) return `${id} baris ${i + 1}: tiap baris harus teks 1..200 huruf.`;
    }
  }
  return null;
}
export function screenCodeErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar teks yang tidak kosong.`;
  for (let i = 0; i < v.length; i++) {
    const s = v[i];
    if (typeof s !== "string" || !s.length || s.length > 200) return `${id} baris ${i + 1}: tiap baris harus teks 1..200 huruf.`;
  }
  return null;
}
export function screenFixErr(v, _ctx, id) {
  if (typeof v !== "string" || !v.length || v.length > 200) return `${id}: harus teks 1..200 huruf.`;
  return null;
}
export function screenPromptErr(v, _ctx, id) {
  if (typeof v !== "string" || !v.length || v.length > 80) return `${id}: harus teks 1..80 huruf.`;
  return null;
}
export function screenRecentErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length < 1 || v.length > 6) return `${id}: harus 1..6 baris.`;
  for (let i = 0; i < v.length; i++) {
    const s = v[i];
    if (typeof s !== "string" || !s.length || s.length > 30) return `${id} baris ${i + 1}: tiap baris harus teks 1..30 huruf.`;
  }
  return null;
}
export function screenPipelineErr(v, ctx, id) {
  if (!Array.isArray(v) || v.length !== 2) return `${id}: harus dua daftar tahapan (sebelum gagal dan sesudah perbaikan).`;
  for (let k = 0; k < 2; k++) {
    const run = v[k];
    if (!Array.isArray(run) || run.length === 0) return `${id} daftar ${k + 1}: harus ada minimal satu tahap.`;
    let prevEnd = -Infinity;
    for (let i = 0; i < run.length; i++) {
      const w = run[i];
      if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `${id} daftar ${k + 1} tahap ${i + 1}: harus [mulai, selesai].`;
      if (!(0 <= (w[0]) && (w[0]) < (w[1]) && (w[1]) <= ctx.len)) return `${id} daftar ${k + 1} tahap ${i + 1}: harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
      if ((w[0]) < prevEnd) return `${id} daftar ${k + 1} tahap ${i + 1}: waktunya tumpang tindih dengan tahap sebelumnya.`;
      prevEnd = w[1];
    }
  }
  return null;
}
export function screenChatErr(v, ctx, id) {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar obrolan yang tidak kosong.`;
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 4) return `${id} baris ${i + 1}: harus [detik, nama, pesan, warna].`;
    if (!isNum(r[0]) || (r[0]) < 0 || (r[0]) > ctx.len) return `${id} baris ${i + 1}: detik harus 0..durasi video (${ctx.len} detik).`;
    if ((r[0]) < prev) return `${id} baris ${i + 1}: detik harus naik terus.`;
    if (typeof r[1] !== "string" || !r[1].length || r[1].length > 12) return `${id} baris ${i + 1}: nama harus 1..12 huruf.`;
    if (typeof r[2] !== "string" || !r[2].length || r[2].length > 80) return `${id} baris ${i + 1}: pesan harus 1..80 huruf.`;
    if (typeof r[3] !== "string" || !CHAT_COLORS.includes(r[3])) return `${id} baris ${i + 1}: warna harus salah satu dari ${CHAT_COLORS.join(", ")}.`;
    prev = r[0];
  }
  return null;
}
export function screenEditorErr(v, _ctx, id) {
  if (typeof v !== "string" || !v.trim()) return `${id}: isinya tidak boleh kosong.`;
  if (!v.includes("[FN")) return `${id}: isinya harus memuat 4 bagian cerita (dimulai dengan baris judul).`;
  const open = (v.match(/\[/g) || []).length;
  const close = (v.match(/\]/g) || []).length;
  if (open !== close) return `${id}: kurung bukanya tidak seimbang — ada baris yang belum ditutup.`;
  if (!v.includes("t<13") || !v.includes("t<18.6")) return `${id}: batas antar bagiannya harus tetap ada (sebelum alarm, konflik, sesudah hapus tanda, beres).`;
  return null;
}
export function fortTextErr(v, _ctx, id) {
  if (typeof v !== "string" || !v.length || v.length > 12) return `${id}: harus teks 1..12 huruf.`;
  if (v.includes("'") || v.includes('"')) return `${id}: tidak boleh memakai tanda kutip.`;
  return null;
}
export function warButtonErr(v, _ctx, id) {
  if (!Array.isArray(v) || v.length !== 4) return `${id}: harus 4 warna.`;
  for (let i = 0; i < 4; i++) {
    const c = v[i];
    if (!Array.isArray(c) || c.length !== 3 || !c.every((n) => isNum(n) && (n) >= 0 && (n) <= 1))
      return `${id} warna ${i + 1}: harus 3 angka 0..1.`;
  }
  return null;
}

/** Satu situs pengganti teks: `s` dicari (atau salah satu alternatifnya),
 *  diganti `r` (rep pertama untuk alt pertama, dst.). Bila `s` tidak
 *  ditemukan tapi `r` sudah ada, situs dianggap sudah diterapkan. */
/** Konstanta bernama lain yang harus ikut disisipkan (rujukan silang antar
 *  pengaturan, mis. rumus yang membaca konstanta momen lain). */

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const constNumRe = (name) => new RegExp("(\\b" + escRe(name) + "\\s*=\\s*)(-?[\\d.]+)");
function findConstNum(html, name) {
  const m = constNumRe(name).exec(html);
  if (!m) return null;
  const v = parseFloat(m[2]);
  return Number.isFinite(v) ? v : null;
}
function findConstArray(html, name) {
  const re = new RegExp("const\\s+" + escRe(name) + "\\s*=\\s*\\[([^\\]]*)\\]");
  const m = re.exec(html);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s));
  return parts.every(Number.isFinite) ? parts : null;
}
/** Sisipkan `line` sebagai baris baru tepat sesudah tag `<script>` pembuka
 *  dari blok skrip yang memuat `marker` — jadi DI ATAS semua kode template
 *  di blok itu. Dipakai untuk deklarasi konstanta sisipan (J1): konstanta
 *  harus sudah ada SEBELUM pemakaian pertamanya di kode top-level template
 *  (inisialisasi partikel, mlay(), pembuatan grup/keyboard, dsb.); sisipan
 *  sebelum `function frame(t){` dulu membuat TDZ karena kode top-level itu
 *  berjalan lebih dulu dan seluruh skrip template mati. ok=false bila
 *  marker / tag tidak ditemukan, atau marker di luar blok skrip itu. */
function insertAtScriptTop(html, marker, line) {
  const at = html.indexOf(marker);
  if (at < 0) return { html, ok: false };
  const open = html.lastIndexOf("<script", at);
  if (open < 0) return { html, ok: false };
  const close = html.indexOf(">", open);
  if (close < 0 || close > at) return { html, ok: false };
  if (html.slice(close + 1, at).includes("</script>")) return { html, ok: false };
  return { html: html.slice(0, close + 1) + "\n" + line + html.slice(close + 1), ok: true };
}
/** Baris `const NAME=...;` yang berdiri sendiri (hasil sisipan J1) —
 *  dibedakan dari deklarasi template sendiri yang menempel di baris
 *  multi-nama (mis. `const T_BOARD=3.2,...,T_FIX=21,...`). Mengembalikan
 *  span barisnya (termasuk baris baru di akhir) atau null. */
function injectedConstLine(html, name, valPat) {
  const re = new RegExp("^[ \\t]*const\\s+" + escRe(name) + "\\s*=\\s*" + valPat + ";[ \\t]*$", "m");
  const m = re.exec(html);
  if (!m) return null;
  const end = m.index + m[0].length + (html[m.index + m[0].length] === "\n" ? 1 : 0);
  return { start: m.index, end };
}
/** Pastikan `const NAME=...` ada (sisipkan bila belum ada, tulis ulang
 *  angkanya bila sudah ada). Deklarasi selalu di ATAS blok skrip utama —
 *  bila deklarasi hasil sisipan lama masih berdiri sebelum frame(), ia
 *  dipindah ke atas supaya pemakaian top-level tidak kena TDZ; deklarasi
 *  template sendiri (multi-nama) ditulis ulang di tempat. `value` angka
 *  atau array angka. `before` hanya dipakai untuk menemukan blok skrip
 *  yang memuatnya. */
function ensureConst(html, name, before, value) {
  if (Array.isArray(value)) {
    const cur = findConstArray(html, name);
    if (cur) {
      const next = [...cur];
      value.forEach((v, i) => { next[i] = v; });
      const line = "const " + name + "=[" + next.map(numFmt).join(",") + "];";
      const old = injectedConstLine(html, name, "\\[[^\\]]*\\]");
      if (old) return insertAtScriptTop(html.slice(0, old.start) + html.slice(old.end), before, line);
      const re = new RegExp("(const\\s+" + escRe(name) + "\\s*=\\s*)\\[[^\\]]*\\]");
      if (!re.test(html)) return { html, ok: false };
      return { html: html.replace(re, (_m, p) => p + "[" + next.map(numFmt).join(",") + "]"), ok: true };
    }
    return insertAtScriptTop(html, before, "const " + name + "=[" + value.map(numFmt).join(",") + "];");
  }
  const line = "const " + name + "=" + numFmt(value) + ";";
  if (constNumRe(name).test(html)) {
    const old = injectedConstLine(html, name, "-?[\\d.]+");
    if (old) return insertAtScriptTop(html.slice(0, old.start) + html.slice(old.end), before, line);
    return { html: html.replace(constNumRe(name), (_m, p) => p + numFmt(value)), ok: true };
  }
  return insertAtScriptTop(html, before, line);
}
/** Pastikan konstanta skalar bernama ada dengan nilai awal (dipakai
 *  rujukan silang `also`). Deklarasi di ATAS blok skrip utama, sama
 *  seperti ensureConst. */
function ensureConstDefault(html, ref) {
  if (findConstNum(html, ref.name) !== null) return { html, ok: true };
  return insertAtScriptTop(html, ref.before, "const " + ref.name + "=" + numFmt(ref.default) + ";");
}
/** Terapkan daftar situs pengganti (J4/J5). Tiap situs: cari alternatif
 *  pertama yang ada lalu ganti SEMUA kemunculannya; bila tidak ada yang
 *  cocok tapi hasil pengganti sudah ada, lewati; bila keduanya tidak ada,
 *  gagal (jangan tulis setengah). */
function applySites(html, sites) {
  let h = html;
  for (const site of sites) {
    const searches = Array.isArray(site[0]) ? site[0] : [site[0]];
    const reps = Array.isArray(site[1]) ? site[1] : [site[1]];
    let done = false;
    for (let i = 0; i < searches.length; i++) {
      if (h.includes(searches[i])) {
        const rep = reps[Math.min(i, reps.length - 1)];
        h = h.split(searches[i]).join(rep);
        done = true;
        break;
      }
    }
    if (done) continue;
    if (reps.some((r) => h.includes(r))) continue;
    return { html: h, ok: false };
  }
  return { html: h, ok: true };
}
/** Parse satu literal string JS ('...' / "...", escape) mulai dari posisi
 *  `i` (spasi dilewati). Mengembalikan nilai + span literalnya. */
function parseJsStringAt(html, i) {
  let j = i;
  while (j < html.length && /[ \t]/.test(html[j])) j++;
  const q = html[j];
  if (q !== "'" && q !== '"') return null;
  let out = "";
  let k = j + 1;
  while (k < html.length) {
    const c = html[k];
    if (c === "\\" && k + 1 < html.length) {
      const e = html[k + 1];
      if (e === "n") out += "\n";
      else if (e === "t") out += "\t";
      else if (e === "r") out += "\r";
      else if (e === "u") { out += String.fromCharCode(parseInt(html.slice(k + 2, k + 6), 16) || 0); k += 4; }
      else out += e;
      k += 2;
      continue;
    }
    if (c === q) return { value: out, start: j, end: k + 1 };
    out += c;
    k++;
  }
  return null;
}
const jsSingle = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
/** Warna balon obrolan yang dipakai template-meeting (nama, bukan kode). */
const CHAT_COLORS = ["ORG", "BLU", "YEL", "GRN", "RED"];
/** Parse array CHAT (baris [detik, nama, pesan, WARNA]) — warnanya nama
 *  (ORG/BLU/...) tanpa kutip, jadi parser literal biasa tidak bisa. */
function parseChat(html) {
  const span = findArraySpan(html, "CHAT");
  if (!span) return null;
  const src = html.slice(span.start, span.end);
  let i = 0;
  const skip = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const parseStr = () => {
    const r = parseJsStringAt(src, i);
    if (!r) return null;
    i = r.end;
    return r.value;
  };
  const parseVal = () => {
    skip();
    const c = src[i];
    if (c === "[") {
      i++;
      const arr = [];
      skip();
      if (src[i] === "]") { i++; return arr; }
      for (;;) {
        arr.push(parseVal());
        skip();
        if (src[i] === ",") { i++; continue; }
        if (src[i] === "]") { i++; return arr; }
        return null;
      }
    }
    if (c === "'" || c === '"') return parseStr();
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const id = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
    if (id) { i += id[0].length; return id[0]; }
    return null;
  };
  const v = parseVal();
  return Array.isArray(v) ? v : null;
}
const chatToJs = (rows) => "[" + (rows).map((r) =>
  "[" + numFmt(r[0]) + "," + JSON.stringify(r[1]) + "," + JSON.stringify(r[2]) + "," +
  (typeof r[3] === "string" && CHAT_COLORS.includes(r[3]) ? r[3] : JSON.stringify(r[3])) + "]").join(",") + "]";
function fortRe(side) {
  return new RegExp("f" + (side === 0 ? "A" : "B") + "=mkFort\\(" + (side === 0 ? "-1" : "1") + ",'([^']*)','(#[0-9a-fA-F]{6})'\\)");
}
function rangeFor(def, file) {
  const r = def.rangeByFile && def.rangeByFile[file];
  if (r) return r;
  return { min: def.min ?? 0, max: def.max ?? 0, step: def.step ?? 0.05 };
}
/** Urutan momen cerita per template (untuk validasi: tiap momen harus
 *  sesudah momen sebelumnya). */
export const BEAT_ORDER = {
  "template.html": ["beat.debate", "beat.tired", "beat.tie", "beat.joy"],
  "template-trio.html": ["beat.debate", "beat.tired", "beat.joy"],
  "template-code.html": ["beat.board", "beat.refactor", "beat.bug", "beat.fix", "beat.tie"],
  "template-kuota.html": ["beat.empty", "beat.frugal", "beat.reset", "beat.relapse"],
  "template-rival.html": ["beat.alert", "beat.teamwork", "beat.joy", "beat.relapse"],
  "template-perang.html": ["beat.war", "beat.punch", "beat.truce", "beat.intern"],
  "template-typing.html": ["beat.typing", "beat.done"],
  "template-deploy.html": ["beat.typing", "beat.panic", "beat.fix", "beat.done"],
  "template-bughunter.html": ["beat.alarm", "beat.squash"],
  "template-bomb.html": ["beat.alarm", "beat.defuse"],
  "template-meeting.html": ["beat.twist"],
  "template-sleep.html": ["beat.wake", "beat.work", "beat.work.end", "beat.sleep"],
};

const anchorFor = (def, file) => (def.anchorByFile && def.anchorByFile[file]) || def.anchor;
// Nilai bawaan anchor const-sites untuk satu file: per-file bila ada
// (defaultByFile), kalau tidak default bersama. Dipakai readProp saat
// konstanta belum ada di template asli (cermin lib/studio.ts — U1 audit-500).
const anchorDefault = (a, file) => {
  const d = a.defaultByFile && a.defaultByFile[file];
  return d !== undefined ? d : a.default;
};

/** Baca satu nilai prop dari HTML (null bila anchor tidak ketemu).
 *  Konstanta sisipan (J1) yang belum ada dibaca sebagai nilai awalnya —
 *  itu perilaku aslinya, jadi tampilan awal sama dengan template asli. */
export function readProp(html, def, file) {
  const a = anchorFor(def, file);
  if (a.t === "array") {
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    if (!Array.isArray(v)) return null;
    const el = v[a.index];
    return typeof el === "number" ? el : typeof el === "string" ? el : null;
  }
  if (a.t === "call") {
    const at = html.indexOf(a.prefix);
    if (at < 0) return null;
    const inner = html.slice(at + a.prefix.length);
    const m = /^[^)]*/.exec(inner);
    if (!m) return null;
    const parts = m[0].split(",").map((s) => parseFloat(s));
    const v = parts[a.index];
    return Number.isFinite(v) ? v : null;
  }
  if (a.t === "hex") {
    const at = html.indexOf(a.prefix);
    if (at < 0) return null;
    const hex = html.slice(at + a.prefix.length, at + a.prefix.length + 6);
    return /^[0-9a-fA-F]{6}$/.test(hex) ? "#" + hex.toLowerCase() : null;
  }
  if (a.t === "whole") {
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    return Array.isArray(v) ? (v) : null;
  }
  if (a.t === "assign") {
    return findConstNum(html, a.name);
  }
  if (a.t === "mkmon") {
    const re = /mkMon\((-?[\d.]+),\(g/g;
    const found = [];
    let m;
    while ((m = re.exec(html)) !== null) found.push(parseFloat(m[1]));
    const v = found[a.index];
    return v !== undefined && Number.isFinite(v) ? v : null;
  }
  if (a.t === "const-sites") {
    const dv = anchorDefault(a, file);
    if (a.index !== undefined) {
      const arr = findConstArray(html, a.name);
      if (arr) return arr[a.index] !== undefined ? arr[a.index] : 0;
      const d = Array.isArray(dv) ? dv : [dv];
      return d[a.index] !== undefined ? d[a.index] : 0;
    }
    const v = findConstNum(html, a.name);
    return v !== null ? v : (Array.isArray(dv) ? dv[0] : dv);
  }
  if (a.t === "assign-sites") {
    return findConstNum(html, a.name);
  }
  if (a.t === "inject-call") {
    const at = html.indexOf(a.prefix);
    if (at < 0) return a.default;
    const inner = html.slice(at + a.prefix.length);
    const m = /^[^)]*/.exec(inner);
    if (!m) return null;
    const parts = m[0].split(",").map((s) => parseFloat(s));
    const v = parts[a.index];
    return Number.isFinite(v) ? v : null;
  }
  if (a.t === "const-line") {
    const v = findConstNum(html, a.name);
    return v !== null ? v : a.default;
  }
  if (a.t === "str") {
    const re = new RegExp("\\b" + escRe(a.name) + "\\s*=");
    const m = re.exec(html);
    if (!m) return null;
    const lit = parseJsStringAt(html, m.index + m[0].length);
    return lit ? lit.value : null;
  }
  if (a.t === "args-list") {
    const at = html.indexOf(a.prefix);
    if (at < 0) return null;
    const out = [];
    let i = at + a.prefix.length;
    for (;;) {
      while (i < html.length && /[ \t]/.test(html[i])) i++;
      if (html[i] === ")") return out;
      const lit = parseJsStringAt(html, i);
      if (!lit) return null;
      out.push(lit.value);
      i = lit.end;
      while (i < html.length && /[ \t]/.test(html[i])) i++;
      if (html[i] === ",") { i++; continue; }
      if (html[i] === ")") return out;
      return null;
    }
  }
  if (a.t === "two-whole") {
    const out = [];
    for (const name of a.names) {
      const span = findArraySpan(html, name);
      if (!span) return null;
      const v = parseJsArray(html.slice(span.start, span.end));
      if (!Array.isArray(v)) return null;
      out.push(v);
    }
    return out;
  }
  if (a.t === "block") {
    const s0 = html.indexOf(a.start);
    if (s0 < 0) return null;
    const v0 = s0 + a.start.length;
    const e0 = html.indexOf(a.end, v0);
    if (e0 < 0) return null;
    return html.slice(v0, e0 + 2);
  }
  if (a.t === "chat") {
    const v = parseChat(html);
    return Array.isArray(v) ? (v) : null;
  }
  if (a.t === "fort-field") {
    const m = fortRe(a.side).exec(html);
    if (!m) return null;
    return a.field === "text" ? m[1] : m[2].toLowerCase();
  }
  if (a.t === "num-between") {
    const at = html.indexOf(a.before);
    if (at < 0) return null;
    const rest = html.slice(at + a.before.length);
    const m = /^\s*(-?[\d.]+)/.exec(rest);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

/** Tulis satu nilai prop ke HTML. ok=false bila anchor tidak ditemukan. */
export function setProp(html, def, file, value) {
  const a = anchorFor(def, file);
  if (a.t === "array") {
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    const v = parseJsArray(html.slice(span.start, span.end));
    if (!Array.isArray(v)) return { html, ok: false };
    const next = [...v];
    next[a.index] = typeof value === "number" ? Math.round(value * 1000) / 1000 : value;
    const ser = "[" + next.map((x) => (typeof x === "string" ? JSON.stringify(x) : numFmt(x))).join(",") + "]";
    return { html: html.slice(0, span.start) + ser + html.slice(span.end), ok: true };
  }
  if (a.t === "call") {
    const at = html.indexOf(a.prefix);
    if (at < 0) return { html, ok: false };
    const start = at + a.prefix.length;
    const close = html.indexOf(")", start);
    if (close < 0) return { html, ok: false };
    const parts = html.slice(start, close).split(",");
    if (a.index >= parts.length) return { html, ok: false };
    parts[a.index] = typeof value === "number" ? numFmt(value) : String(value);
    return { html: html.slice(0, start) + parts.join(",") + html.slice(close), ok: true };
  }
  if (a.t === "hex") {
    if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return { html, ok: false };
    const at = html.indexOf(a.prefix);
    if (at < 0) return { html, ok: false };
    const hex = value.slice(1).toLowerCase();
    return { html: html.slice(0, at + a.prefix.length) + hex + html.slice(at + a.prefix.length + 6), ok: true };
  }
  if (a.t === "whole") {
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    return { html: html.slice(0, span.start) + JSON.stringify(value) + html.slice(span.end), ok: true };
  }
  if (a.t === "assign") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    const re = constNumRe(a.name);
    if (!re.test(html)) return { html, ok: false };
    return { html: html.replace(re, (_m, p) => p + numFmt(value)), ok: true };
  }
  if (a.t === "mkmon") {
    const re = /mkMon\((-?[\d.]+),\(g/g;
    const found = [];
    let m;
    while ((m = re.exec(html)) !== null) found.push({ start: m.index + "mkMon(".length, end: m.index + "mkMon(".length + m[1].length });
    const hit = found[a.index];
    if (!hit || typeof value !== "number") return { html, ok: false };
    return { html: html.slice(0, hit.start) + numFmt(value) + html.slice(hit.end), ok: true };
  }
  if (a.t === "const-sites") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    let h = html;
    if (a.index !== undefined) {
      const cur = findConstArray(h, a.name);
      const baseArr = cur ? [...cur] : (Array.isArray(a.default) ? [...(a.default)] : [a.default]);
      while (baseArr.length <= a.index) baseArr.push(0);
      baseArr[a.index] = Math.round(value * 1000) / 1000;
      const r = ensureConst(h, a.name, a.before, baseArr);
      if (!r.ok) return { html, ok: false };
      h = r.html;
    } else {
      const r = ensureConst(h, a.name, a.before, value);
      if (!r.ok) return { html, ok: false };
      h = r.html;
    }
    for (const ref of a.also || []) {
      const r = ensureConstDefault(h, ref);
      if (!r.ok) return { html, ok: false };
      h = r.html;
    }
    const sites = (a.sitesByFile && a.sitesByFile[file]) || a.sites;
    return applySites(h, sites);
  }
  if (a.t === "assign-sites") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    const re = constNumRe(a.name);
    if (!re.test(html)) return { html, ok: false };
    const h = html.replace(re, (_m, p) => p + numFmt(value));
    return applySites(h, a.sites);
  }
  if (a.t === "inject-call") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    let h = html;
    if (h.indexOf(a.prefix) < 0) {
      const at = h.indexOf(a.after);
      if (at < 0) return { html, ok: false };
      const nl = h.indexOf("\n", at);
      if (nl < 0) return { html, ok: false };
      h = h.slice(0, nl + 1) + a.text + "\n" + h.slice(nl + 1);
    }
    const p0 = h.indexOf(a.prefix);
    if (p0 < 0) return { html, ok: false };
    const start = p0 + a.prefix.length;
    const close = h.indexOf(")", start);
    if (close < 0) return { html, ok: false };
    const parts = h.slice(start, close).split(",");
    if (a.index >= parts.length) return { html, ok: false };
    parts[a.index] = numFmt(value);
    return { html: h.slice(0, start) + parts.join(",") + h.slice(close), ok: true };
  }
  if (a.t === "const-line") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    let h = html;
    const r = ensureConst(h, a.name, a.before, value);
    if (!r.ok) return { html, ok: false };
    h = r.html;
    if (!h.includes(a.insertText)) {
      const at = h.indexOf(a.after);
      if (at < 0) return { html, ok: false };
      const ins = h.indexOf(a.insertAfter, at);
      if (ins < 0) return { html, ok: false };
      const pos = ins + a.insertAfter.length;
      h = h.slice(0, pos) + a.insertText + h.slice(pos);
    }
    return { html: h, ok: true };
  }
  if (a.t === "str") {
    if (typeof value !== "string") return { html, ok: false };
    const re = new RegExp("\\b" + escRe(a.name) + "\\s*=");
    const m = re.exec(html);
    if (!m) return { html, ok: false };
    const lit = parseJsStringAt(html, m.index + m[0].length);
    if (!lit) return { html, ok: false };
    return { html: html.slice(0, lit.start) + jsSingle(value) + html.slice(lit.end), ok: true };
  }
  if (a.t === "args-list") {
    if (!Array.isArray(value) || !value.every((x) => typeof x === "string")) return { html, ok: false };
    const at = html.indexOf(a.prefix);
    if (at < 0) return { html, ok: false };
    const close = html.indexOf(")", at + a.prefix.length);
    if (close < 0) return { html, ok: false };
    const inner = (value).map(jsSingle).join(",");
    return { html: html.slice(0, at + a.prefix.length) + inner + html.slice(close), ok: true };
  }
  if (a.t === "two-whole") {
    if (!Array.isArray(value) || value.length !== 2) return { html, ok: false };
    let h = html;
    for (let k = 0; k < 2; k++) {
      const span = findArraySpan(h, a.names[k]);
      if (!span) return { html, ok: false };
      h = h.slice(0, span.start) + JSON.stringify(value[k]) + h.slice(span.end);
    }
    return { html: h, ok: true };
  }
  if (a.t === "block") {
    if (typeof value !== "string") return { html, ok: false };
    const s0 = html.indexOf(a.start);
    if (s0 < 0) return { html, ok: false };
    const v0 = s0 + a.start.length;
    const e0 = html.indexOf(a.end, v0);
    if (e0 < 0) return { html, ok: false };
    return { html: html.slice(0, v0) + value + html.slice(e0 + 2), ok: true };
  }
  if (a.t === "chat") {
    if (!Array.isArray(value)) return { html, ok: false };
    const span = findArraySpan(html, "CHAT");
    if (!span) return { html, ok: false };
    return { html: html.slice(0, span.start) + chatToJs(value) + html.slice(span.end), ok: true };
  }
  if (a.t === "fort-field") {
    const re = fortRe(a.side);
    const m = re.exec(html);
    if (!m) return { html, ok: false };
    if (a.field === "text") {
      if (typeof value !== "string" || value.includes("'")) return { html, ok: false };
      return { html: html.replace(re, (_mm, _t, c) => "f" + (a.side === 0 ? "A" : "B") + "=mkFort(" + (a.side === 0 ? "-1" : "1") + ",'" + value + "','" + c + "')"), ok: true };
    }
    if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return { html, ok: false };
    return { html: html.replace(re, (_mm, t) => "f" + (a.side === 0 ? "A" : "B") + "=mkFort(" + (a.side === 0 ? "-1" : "1") + ",'" + t + "','" + value.toLowerCase() + "')"), ok: true };
  }
  if (a.t === "num-between") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    const at = html.indexOf(a.before);
    if (at < 0) return { html, ok: false };
    const rest = html.slice(at + a.before.length);
    const m = /^(\s*)(-?[\d.]+)/.exec(rest);
    if (!m) return { html, ok: false };
    const pos = at + a.before.length + m[1].length;
    return { html: html.slice(0, pos) + numFmt(value) + html.slice(pos + m[2].length), ok: true };
  }
  return { html, ok: false };
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
  // Sinkron garis tepi balon kata (lihat lib/studio.ts).
  if ('claude.color' in props && typeof props['claude.color'] === 'string') {
    const col = props['claude.color'].slice(1).toLowerCase();
    h = h.replace(
      /border:max\(1px,calc\(var\(--u\)\*\.2\)\) solid #[0-9a-fA-F]{6}/g,
      `border:max(1px,calc(var(--u)*.2)) solid #${col}`
    );
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
    if (c.length > 3 && c[3] !== undefined && (!Number.isInteger(c[3]) || c[3] < 0 || c[3] > 2)) errors.push(`Caption #${n}: pengisi suara harus 0, 1, atau 2.`);
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
    [['kamera', 1], ['arah pandang', 2]].forEach(([what, k]) => {
      const v = s[k];
      if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) errors.push(`Shot #${n}: ${what} harus 3 angka.`);
    });
    if (i > 0 && s[0] <= shots[i - 1][0]) errors.push(`Shot #${n}: tidak terurut (mulai <= shot #${i}).`);
    const end = i + 1 < shots.length ? shots[i + 1][0] : len;
    if (end - s[0] < 0.5) warnings.push(`Shot #${n}: hanya ${(end - s[0]).toFixed(1)} dtk — potongan sangat cepat.`);
  });
  return { errors, warnings };
}

/** Validasi props: jarak antar maskot, bingkai, rentang tiap pengaturan
 *  (per template bila berbeda), urutan momen cerita, dan aturan jaga
 *  antar pengaturan (papan, benteng/katapel, cangkir, goyangan).
 *  Pesan diawali id pengaturan supaya UI bisa menaruhnya di baris yang
 *  benar; tampilannya dibersihkan dari id itu di Studio. */
export function validateProps(propsIn, file, len = 0) {
  const props = normalizeProps(propsIn);
  const errors = [];
  const warnings = [];
  const xs = [];
  for (const id of ["claude.x", "codex.x", "gemini.x"]) {
    const v = props[id];
    if (typeof v === "number") {
      xs.push({ id, v });
      if (Math.abs(v) > 3.2) errors.push(`${id}: terlalu jauh ke tepi — maskot keluar dari layar.`);
      else if (Math.abs(v) > 2.9) warnings.push(`${id}: sudah dekat tepi layar.`);
    }
  }
  xs.sort((a, b) => a.v - b.v);
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i].v - xs[i - 1].v;
    if (gap <= 0.1) errors.push(`${xs[i - 1].id} dan ${xs[i].id}: kedua maskot bertabrakan — geser salah satunya.`);
    else if (gap < 2.6) warnings.push(`${xs[i - 1].id} dan ${xs[i].id}: jarak ${gap.toFixed(2)} — layarnya bisa tumpang tindih.`);
  }
  for (const def of PROP_DEFS) {
    if (!(def.id in props)) continue;
    const v = props[def.id];
    const r = rangeFor(def, file);
    if (def.kind === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        errors.push(`${def.id}: harus angka.`);
        continue;
      }
      if (v < r.min) errors.push(`${def.id}: ${v} di bawah batas ${r.min}.`);
      if (v > r.max) errors.push(`${def.id}: ${v} di atas batas ${r.max}.`);
      if (Number.isInteger(r.step) && !Number.isInteger(v)) errors.push(`${def.id}: harus bilangan bulat.`);
    } else if (def.kind === "color") {
      if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`${def.id}: warna harus dipilih dari pemilih warna.`);
    } else if (def.kind === "text") {
      if (typeof v !== "string") errors.push(`${def.id}: harus teks.`);
    } else if (def.kind === "array") {
      if (!Array.isArray(v)) errors.push(`${def.id}: harus daftar.`);
    }
    if (typeof def.validate === "function") {
      const e = def.validate(v, { len }, def.id);
      if (e) errors.push(e);
    }
  }
  // Urutan momen cerita harus terjaga.
  const order = BEAT_ORDER[file] || [];
  const defById = new Map(PROP_DEFS.map((d) => [d.id, d]));
  for (let i = 1; i < order.length; i++) {
    const a = props[order[i - 1]];
    const b = props[order[i]];
    if (typeof a === "number" && typeof b === "number" && !(b > a)) {
      const pa = defById.get(order[i - 1]);
      const pb = defById.get(order[i]);
      errors.push(`${order[i]}: ${pb ? pb.plain : order[i]} harus sesudah ${pa ? pa.plain : order[i - 1]} — waktunya tabrakan, geser sedikit.`);
    }
  }
  // Angka awal + naik-turun papan tidak boleh lebih dari 100.
  const bb = props["board.base"];
  const bs = props["board.swing"];
  if (typeof bb === "number" && typeof bs === "number" && bb + bs > 100)
    errors.push("board.base: angka awal ditambah naik-turun tidak boleh lebih dari 100.");
  // Benteng dan katapel tidak boleh menembus satu sama lain.
  const fd = props["fort.distance"];
  const cd = props["catapult.distance"];
  if (typeof fd === "number" && typeof cd === "number" && fd - cd < 1.3)
    errors.push("fort.distance: benteng dan katapel terlalu dekat — jarak keduanya minimal 1,3.");
  // Deretan cangkir harus tetap di atas meja.
  const mr = props["mug.row"];
  const mg = props["mug.gap"];
  if (typeof mr === "number" && typeof mg === "number" && mr + 2 * mg > 2.6)
    errors.push("mug.row: deretan cangkir melewati ujung meja — geser ke kiri atau rapatkan jaraknya.");
  // Posisi dasar + goyangan maskot tunggal harus tetap di atas meja.
  const mx = props["claude.x"];
  const sw = props["claude.sway"];
  if (typeof mx === "number" && typeof sw === "number" && SINGLE.includes(file) && Math.abs(mx) + sw > 1.2)
    errors.push("claude.x: maskot terlalu jauh dari meja — geser mendekat atau kecilkan goyangannya.");
  // Layar kecil jangan jauh dari maskotnya (kecuali perang: tanpa layar kecil).
  const pairs = [["monitor.claude.x", "claude.x"], ["monitor.codex.x", "codex.x"], ["monitor.gemini.x", "gemini.x"]];
  for (const [mon, mas] of pairs) {
    const a = props[mon];
    const b = props[mas];
    if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) > 0.8)
      warnings.push(`${mon}: layarnya jauh dari maskotnya — layar dan maskot jadi tidak sejajar.`);
  }
  return { errors, warnings };
}
/** Baca semua prop registry dari HTML template + file-nya. */
export function parseProps(html, file) {
  return PROP_DEFS.map((def) => {
    if (!def.files.includes(file)) return { def, available: false, reason: def.unavailableReason };
    const v = readProp(html, def, file);
    if (v === null) return { def, available: false, reason: 'Pola literal tidak ditemukan di template ini.' };
    return { def, available: true, value: v };
  });
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
  // Aturan jaga antar pengaturan (cermin validateProps() di lib/mjs):
  // urutan momen cerita, papan, benteng/katapel, cangkir, goyangan maskot.
  // Dibaca dari HTML AKHIR supaya nilai yang sudah disisipkan ikut diperiksa.
  const readNum = (id) => {
    const def = PROP_DEFS.find((d) => d.id === id);
    if (!def) return null;
    const v = readProp(html, def, file);
    return typeof v === 'number' ? v : null;
  };
  const beatIds = BEAT_ORDER[file] || [];
  if (beatIds.some((id) => touched.has(id))) {
    let prev = null;
    for (const id of beatIds) {
      const v = readNum(id);
      if (v === null) { prev = null; continue; }
      if (prev !== null && !(v > prev)) errors.push(`${id}: momen ini harus sesudah momen sebelumnya — waktunya tabrakan, geser sedikit.`);
      prev = v;
    }
  }
  if (touched.has('board.base') || touched.has('board.swing')) {
    const bb = readNum('board.base'), bs = readNum('board.swing');
    if (bb !== null && bs !== null && bb + bs > 100) errors.push('board.base: angka awal ditambah naik-turun tidak boleh lebih dari 100.');
  }
  if (touched.has('fort.distance') || touched.has('catapult.distance')) {
    const fd = readNum('fort.distance'), cd = readNum('catapult.distance');
    if (fd !== null && cd !== null && fd - cd < 1.3) errors.push('fort.distance: benteng dan katapel terlalu dekat — jarak keduanya minimal 1,3.');
  }
  if (touched.has('mug.row') || touched.has('mug.gap')) {
    const mr = readNum('mug.row'), mg = readNum('mug.gap');
    if (mr !== null && mg !== null && mr + 2 * mg > 2.6) errors.push('mug.row: deretan cangkir melewati ujung meja — geser ke kiri atau rapatkan jaraknya.');
  }
  if (touched.has('claude.x') || touched.has('claude.sway')) {
    const mx = readNum('claude.x'), sw = readNum('claude.sway');
    if (mx !== null && sw !== null && SINGLE.includes(file) && Math.abs(mx) + sw > 1.2) errors.push('claude.x: maskot terlalu jauh dari meja — geser mendekat atau kecilkan goyangannya.');
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
