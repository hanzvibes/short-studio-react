import registry from "../public/templates.json";

export interface TemplateEntry {
  file: string;
  label: string;
  kind: string;
  title?: string;
  sub?: string;
  end?: string;
}

export const TEMPLATES: TemplateEntry[] = registry as TemplateEntry[];

export const slug = (t: TemplateEntry) => t.file.replace(/\.html$/, "");

/** Warna pembicara, sama seperti studio vanilla (SPK). */
export const SPK = ["#f08a4b", "#5b8dff", "#9aa0aa"];

export type Shot = [number, number[], number[]];
/** Cap arity 3 (tanpa speaker, mis. typing/deploy/meeting) atau 4 (dengan speaker 0..2). */
export type Cap = [number, number, string, number?];

export interface TextFields {
  title: string;
  sub: string;
  end: string;
}

export const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const fmt = (t: number) => {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ":" + pad(s);
};
export const fmt1 = (t: number) => (Math.round(t * 10) / 10).toFixed(1) + "s";
export const fmtTC = (t: number, len: number, fps = 60) => {
  t = clamp(t || 0, 0, len || 0);
  const f = Math.floor((t % 1) * fps);
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
};
export const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Baca judul / subjudul / end card asli dari markup template. Sama seperti parseDefaults() di studio.js. */
export function parseDefaults(html: string, t: TemplateEntry): TextFields {
  const out: TextFields = { title: t.title || "", sub: t.sub || "", end: t.end || "" };
  try {
    const d = new DOMParser().parseFromString(html, "text/html");
    const grab = (id: string) => {
      const el = d.getElementById(id);
      if (!el) return null;
      const c = el.cloneNode(true) as HTMLElement;
      const sm = c.querySelector("small");
      const sub = sm ? (sm.textContent || "").trim() : "";
      c.querySelectorAll("svg,small,.cr").forEach((n) => n.remove());
      c.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
      let text = (c.textContent || "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .trim();
      if (id === "title") text = text.replace(/\s*\n\s*/g, " ");
      return { text, sub };
    };
    const ti = grab("title");
    const en = grab("end");
    if (ti) {
      out.title = ti.text || out.title;
      out.sub = ti.sub || out.sub;
    }
    if (en) out.end = en.text || out.end;
  } catch {
    /* pakai templates.json */
  }
  return out;
}

const toHtml = (v: string) => esc(v).replace(/\n/g, "<br>");

/** Ganti teks judul/sub/end di string HTML template. Sama seperti setText() di studio.js dan scripts/export.mjs — ketiganya harus tetap sinkron. */
export function setText(html: string, f: Partial<TextFields>): string {
  let h = html;
  if (f.title !== undefined) {
    h = h.replace(
      /(<div id="title">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (_m, a, _b, c) => a + toHtml(f.title as string) + c
    );
  }
  if (f.sub !== undefined) {
    h = h.replace(
      /(<div id="title">[\s\S]*?<small\b[^>]*>)([\s\S]*?)(<\/small><\/div>)/,
      (_m, a, _b, c) => a + esc(f.sub as string) + c
    );
  }
  if (f.end !== undefined) {
    h = h.replace(
      /(<div id="end">[\s\S]*?class="st"><\/svg>)([\s\S]*?)(<b class="cr">[\s\S]*?<\/b>)?(<small\b[^>]*>[\s\S]*?<\/small><\/div>)/,
      (_m, a, _b, cr, c) => a + toHtml(f.end as string) + (cr || "") + c
    );
  }
  return h;
}

/**
 * ============ EDIT CAPS / SHOTS / VO / PROPS ============
 * SINKRON dengan scripts/apply-edit.mjs (implementasi JS yang sama) dan
 * scripts/export.mjs --edit (mengimpor dari apply-edit.mjs).
 * Aturan main: penggantian array WAJIB pakai bracket-matching
 * (findArraySpan), JANGAN regex [\s\S]*? — isi array bersarang dan berisi
 * string dengan koma/kutip. Semua setter mengembalikan { html, ok }:
 * ok=false berarti pola tidak ditemukan dan html dikembalikan apa adanya.
 *
 * Format spec kanonik (dipakai Studio, apply-edit.mjs, export.mjs --edit):
 *   { "file":"template-code.html", "title":"...", "sub":"...", "end":"...",
 *     "caps":[[t0,t1,"teks",speaker?],...],
 *     "shots":[[t0,[x,y,z],[x,y,z]],...],
 *     "vo":["...",...],
 *     "props":{ "claude.x": -1.5, "codex.color": "#7b8cff", ... } }
 * - "vo" opsional: bila caps diedit dan vo tidak diisi, VO[i] := teks caps
 *   baru (VO literal diganti; VO turunan `caps.map(c=>c[2])` sudah mengikuti
 *   otomatis dan tidak disentuh).
 * - "props" opsional: kunci = id prop dari PROP_DEFS di bawah, nilai =
 *   number (posisi/skala), string "#rrggbb" (warna), atau array (prop
 *   array: skor papan, kurva tangki, sticky notes, spawn/ketapel perang,
 *   jendela/baris ketik). Format KANONIK = object map:
 *   { "claude.x": -1.5, "codex.color": "#7b8cff", ... }.
 *   Bentuk array [{"id":"claude.x","value":-1.5}, ...] adalah ALIAS LAMA
 *   yang tetap diterima (normalizeProps) — applyEdits/setProps/
 *   validateProps menerima keduanya dengan hasil yang sama.
 *   Nilai array ditulis ulang utuh dengan JSON.stringify.
 */

/** Hasil setter: html baru + ok=false bila pola tidak ditemukan. */
export interface EditResult {
  html: string;
  ok: boolean;
}

/** Cari span array literal setelah `name=` — scan kurung seimbang dengan
 *  kesadaran string ('...', "...") + escape + komentar garis dan blok.
 *  Mengembalikan [start, end) dari '[' sampai ']' penutup, atau null. */
export function findArraySpan(html: string, name: string): { start: number; end: number } | null {
  const re = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=");
  const m = re.exec(html);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < html.length && /[ \t]/.test(html[i])) i++;
  if (html[i] !== "[") return null;
  let depth = 0;
  let instr: string | null = null;
  let esc = false;
  let lineComment = false;
  let blockComment = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    const nx = html[j + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && nx === "/") {
        blockComment = false;
        j++;
      }
      continue;
    }
    if (instr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === instr) instr = null;
      continue;
    }
    if (c === "/" && nx === "/") {
      lineComment = true;
      continue;
    }
    if (c === "/" && nx === "*") {
      blockComment = true;
      continue;
    }
    if (c === "'" || c === '"') {
      instr = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return { start: i, end: j + 1 };
    }
  }
  return null;
}

/** Parser kecil untuk literal array JS: angka, string '...'/"..." (escape),
 *  array bersarang, true/false/null. Komentar garis dan blok diabaikan.
 *  Mengembalikan nilai ter-parse atau null bila bukan literal valid.
 *  (Tidak pakai eval/Function — isi template tidak dieksekusi.) */
export function parseJsArray(src: string): unknown | null {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith("//", i)) {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (src.startsWith("/*", i)) {
        const e = src.indexOf("*/", i + 2);
        if (e < 0) return;
        i = e + 2;
      } else return;
    }
  };
  const parseString = (): string | null => {
    const q = src[i];
    i++;
    let out = "";
    while (i < src.length) {
      const c = src[i++];
      if (c === "\\" && i < src.length) {
        const e = src[i++];
        if (e === "n") out += "\n";
        else if (e === "t") out += "\t";
        else if (e === "r") out += "\r";
        else if (e === "u") {
          out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16) || 0);
          i += 4;
        } else out += e;
        continue;
      }
      if (c === q) return out;
      out += c;
    }
    return null;
  };
  const parseValue = (): unknown => {
    skip();
    const c = src[i];
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
      skip();
      if (src[i] === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValue());
        skip();
        if (src[i] === ",") {
          i++;
          continue;
        }
        if (src[i] === "]") {
          i++;
          return arr;
        }
        return null;
      }
    }
    if (c === "{") {
      // Object literal {k: v, "k2": v} — dipakai NT (rival.notes). Kunci boleh
      // telanjang (f, to, a, ...) atau string. (Cermin parseJsArray di
      // scripts/apply-edit.mjs — keduanya harus tetap sinkron.)
      i++;
      const obj: Record<string, unknown> = {};
      skip();
      if (src[i] === "}") {
        i++;
        return obj;
      }
      for (;;) {
        skip();
        let key: string | null;
        if (src[i] === "'" || src[i] === '"') key = parseString();
        else {
          const km = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
          if (!km) return null;
          key = km[0];
          i += key.length;
        }
        skip();
        if (src[i] !== ":") return null;
        i++;
        obj[key as string] = parseValue();
        skip();
        if (src[i] === ",") {
          i++;
          continue;
        }
        if (src[i] === "}") {
          i++;
          return obj;
        }
        return null;
      }
    }
    if (c === "'" || c === '"') return parseString();
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      return parseFloat(num[0]);
    }
    for (const [lit, val] of [["true", true], ["false", false], ["null", null]] as const) {
      if (src.startsWith(lit, i)) {
        i += lit.length;
        return val;
      }
    }
    return null;
  };
  const v = parseValue();
  if (v === null || v === undefined) return null;
  skip();
  return v;
}

const numFmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const capsToJs = (caps: Cap[]) =>
  "[" +
  caps
    .map(
      (c) =>
        "[" +
        numFmt(c[0]) +
        "," +
        numFmt(c[1]) +
        "," +
        JSON.stringify(c[2]) +
        (c.length > 3 && c[3] !== undefined ? "," + c[3] : "") +
        "]"
    )
    .join(",") +
  "]";
const shotsToJs = (shots: Shot[]) =>
  "[" +
  shots
    .map(
      (s) =>
        "[" +
        numFmt(s[0]) +
        ",[" +
        s[1].map(numFmt).join(",") +
        "],[" +
        s[2].map(numFmt).join(",") +
        "]" +
        "]"
    )
    .join(",") +
  "]";
const voToJs = (vo: string[]) => "[" + vo.map((v) => JSON.stringify(v)).join(",") + "]";

/** Ganti satu array bernama (caps/shots/...) dengan serialisasi baru. */
function replaceArray(html: string, name: string, serialized: string): EditResult {
  const span = findArraySpan(html, name);
  if (!span) return { html, ok: false };
  return { html: html.slice(0, span.start) + serialized + html.slice(span.end), ok: true };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Parse caps dari HTML template. Toleran arity 3 ([t0,t1,teks]) dan 4
 *  ([t0,t1,teks,speaker]); null bila tidak ditemukan / bukan literal. */
export function parseCaps(html: string): Cap[] | null {
  const span = findArraySpan(html, "caps");
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v)) return null;
  const out: Cap[] = [];
  for (const row of v) {
    if (!Array.isArray(row) || (row.length !== 3 && row.length !== 4)) return null;
    if (!isNum(row[0]) || !isNum(row[1]) || typeof row[2] !== "string") return null;
    if (row.length === 4 && !isNum(row[3])) return null;
    out.push(row.length === 4 ? [row[0], row[1], row[2], row[3]] : [row[0], row[1], row[2]]);
  }
  return out;
}

/** Parse shots dari HTML template. Bentuk selalu [[t0,[x,y,z],[x,y,z]],...]
 *  (komentar // di dalam array — mis. template-sleep — diabaikan parser).
 *  Null bila tidak ditemukan / bukan literal. */
export function parseShots(html: string): Shot[] | null {
  const span = findArraySpan(html, "shots");
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v)) return null;
  const out: Shot[] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== 3) return null;
    if (!isNum(row[0]) || !Array.isArray(row[1]) || !Array.isArray(row[2])) return null;
    if (row[1].length !== 3 || row[2].length !== 3) return null;
    if (!row[1].every(isNum) || !row[2].every(isNum)) return null;
    out.push([row[0], [...(row[1] as number[])], [...(row[2] as number[])]]);
  }
  return out;
}

/** Bentuk VO di template: 'literal' (array string), 'derived'
 *  (`VO=caps.map(c=>c[2])` — mengikuti caps otomatis), atau 'none'. */
export type VoKind = "literal" | "derived" | "none";
export function voKind(html: string): VoKind {
  const re = /\bVO\s*=/;
  const m = re.exec(html);
  if (!m) return "none";
  let i = m.index + m[0].length;
  while (i < html.length && /[ \t]/.test(html[i])) i++;
  if (html[i] === "[") return "literal";
  if (html.startsWith("caps.map", i)) return "derived";
  return "none";
}

/** Parse VO literal. Null bila VO turunan (caps.map) atau tidak ada —
 *  pemanggil harus cek voKind() untuk membedakannya. */
export function parseVO(html: string): string[] | null {
  if (voKind(html) !== "literal") return null;
  const span = findArraySpan(html, "VO");
  if (!span) return null;
  const v = parseJsArray(html.slice(span.start, span.end));
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return null;
  return [...(v as string[])];
}

export function setCaps(html: string, caps: Cap[]): EditResult {
  return replaceArray(html, "caps", capsToJs(caps));
}
export function setShots(html: string, shots: Shot[]): EditResult {
  return replaceArray(html, "shots", shotsToJs(shots));
}

/** Ganti VO: array literal diganti utuh; ekspresi turunan `caps.map(...)`
 *  diganti dengan array literal (ekspresi dipindai sampai koma/; top-level).
 *  ok=false bila `VO=` tidak ditemukan. */
export function setVO(html: string, vo: string[]): EditResult {
  const kind = voKind(html);
  if (kind === "literal") return replaceArray(html, "VO", voToJs(vo));
  if (kind === "derived") {
    const re = /\bVO\s*=/;
    const m = re.exec(html);
    if (!m) return { html, ok: false };
    let i = m.index + m[0].length;
    while (i < html.length && /[ \t]/.test(html[i])) i++;
    // Pindai ekspresi sampai ',' atau ';' di level 0 (hormati string/parens).
    let depth = 0;
    let instr: string | null = null;
    let esc = false;
    let j = i;
    for (; j < html.length; j++) {
      const c = html[j];
      if (instr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === instr) instr = null;
        continue;
      }
      if (c === "'" || c === '"') instr = c;
      else if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      else if ((c === "," || c === ";") && depth === 0) break;
    }
    return { html: html.slice(0, i) + voToJs(vo) + html.slice(j), ok: true };
  }
  return { html, ok: false };
}

export interface Validation {
  errors: string[];
  warnings: string[];
}

const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Validasi caps: errors = blokir Terapkan; warnings = kuning saja.
 *  Aturan: terurut, 0<=t0<t1<=LEN, tidak tumpang tindih, speaker 0..2,
 *  kata/detik <= 2.5 (warning, bukan error — kecepatan bicara masih bisa
 *  dibaca walau padat). */
export function validateCaps(caps: Cap[], len: number): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  caps.forEach((c, i) => {
    const n = i + 1;
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) {
      errors.push(`Caption #${n}: waktu mulai/selesai bukan angka.`);
      return;
    }
    if (c[0] < 0) errors.push(`Caption #${n}: mulai ${c[0]}s < 0.`);
    if (c[1] > len) errors.push(`Caption #${n}: selesai ${c[1]}s melebihi durasi ${len}s.`);
    if (!(c[1] > c[0])) errors.push(`Caption #${n}: selesai harus sesudah mulai.`);
    if (!c[2] || !c[2].trim()) errors.push(`Caption #${n}: teks kosong.`);
    if (c.length > 3 && c[3] !== undefined && (!Number.isInteger(c[3]) || (c[3] as number) < 0 || (c[3] as number) > 2))
      errors.push(`Caption #${n}: speaker harus 0, 1, atau 2.`);
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

/** Validasi shots: terurut, 0<=t0<LEN, kamera/lookAt 3 angka finite.
 *  Shot <0.5 dtk hanya warning (potongan sangat cepat). */
export function validateShots(shots: Shot[], len: number): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  shots.forEach((s, i) => {
    const n = i + 1;
    if (!Number.isFinite(s[0])) {
      errors.push(`Shot #${n}: waktu mulai bukan angka.`);
      return;
    }
    if (s[0] < 0) errors.push(`Shot #${n}: mulai ${s[0]}s < 0.`);
    if (s[0] >= len) errors.push(`Shot #${n}: mulai ${s[0]}s >= durasi ${len}s.`);
    (["kamera", "lookAt"] as const).forEach((what, k) => {
      const v = s[k + 1];
      if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum))
        errors.push(`Shot #${n}: ${what} harus 3 angka.`);
    });
    if (i > 0 && s[0] <= shots[i - 1][0]) errors.push(`Shot #${n}: tidak terurut (mulai <= shot #${i}).`);
    const end = i + 1 < shots.length ? shots[i + 1][0] : len;
    if (end - s[0] < 0.5) warnings.push(`Shot #${n}: hanya ${(end - s[0]).toFixed(1)} dtk — potongan sangat cepat.`);
  });
  return { errors, warnings };
}

/**
 * ============ PROPS ============
 * Inventarisasi dari kode scene nyata (bukan asumsi) — lihat matriks di
 * README.md. Satu prop = satu nilai literal yang bisa ditulis ulang di
 * string HTML. Bila nilai dihitung di frame() (mis. posisi maskot tunggal
 * dari sway/turn) atau tersebar di banyak panggilan box() (benteng perang),
 * prop itu TIDAK ada di registry — UI menampilkannya sebagai nonaktif
 * dengan alasan, bukan dipalsukan.
 *
 * Anchor:
 * - {t:"array",name,index} : elemen ke-index dari `name=[...]` (X/gx/CC).
 * - {t:"call",prefix,index} : angka ke-index di dalam `prefix...` —
 *   prefix unik di template, mis. "dm.scale.setScalar(" atau
 *   "scr.position.set(" (index 0=x, 1=y, 2=z).
 * - {t:"hex",prefix} : warna "0xrrggbb" sesudah prefix, mis. "OR=M(0x".
 * - {t:"mkmon",index} : argumen pertama panggilan mkMon() ke-index
 *   (definisi `const mkMon=(x,fn,col)` dilewati — hanya panggilan).
 * - {t:"whole",name} : SELURUH array `name=[...]` diganti utuh
 *   (JSON.stringify) — prop array (RK/EV/SP/NT/WIN/TL/CL0/...).
 * - {t:"assign",name} : satu angka `NAME=...` diganti (MEET_END).
 */
export type PropAnchor =
  | { t: "array"; name: string; index: number }
  | { t: "call"; prefix: string; index: number }
  | { t: "hex"; prefix: string }
  | { t: "mkmon"; index: number }
  | { t: "whole"; name: string }
  | { t: "assign"; name: string };

export interface PropDef {
  id: string;
  label: string;
  group: string;
  kind: "number" | "color" | "array";
  min?: number;
  max?: number;
  step?: number;
  /** Template yang punya prop ini (file). Di luar daftar: nonaktif. */
  files: string[];
  /** Alasan nonaktif untuk template di luar `files`. */
  unavailableReason: string;
  anchor: PropAnchor;
  /** Anchor berbeda untuk file tertentu (mis. perang pakai `gx`, bukan `X`;
   *  monitor Codex trio = panggilan mkMon ke-2, bukan ke-1). */
  anchorByFile?: Record<string, PropAnchor>;
  /** Validator nilai untuk def 'array' (dan yang lain bila perlu):
   *  kembalikan string error atau null. ctx.len = durasi template (LEN). */
  validate?: (v: unknown, ctx: { len: number }) => string | null;
}

const MULTI = ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html", "template-perang.html"];
const SINGLE = ["template-typing.html", "template-deploy.html", "template-bughunter.html", "template-bomb.html", "template-meeting.html", "template-sleep.html"];
const WITH_MON = ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html"];
const WITH_MUG = ["template-typing.html", "template-deploy.html", "template-bughunter.html", "template-bomb.html", "template-sleep.html"];

export const PROP_DEFS: PropDef[] = [
  { id: "claude.x", label: "Claude · posisi X", group: "Maskot", kind: "number", min: -3, max: 3, step: 0.05, files: MULTI,
    unavailableReason: "Template ini hanya punya satu maskot; posisinya dihitung animasi frame() (sway/turn), bukan nilai literal.",
    anchor: { t: "array", name: "X", index: 0 }, anchorByFile: { "template-perang.html": { t: "array", name: "gx", index: 0 } } },
  { id: "codex.x", label: "Codex · posisi X", group: "Maskot", kind: "number", min: -3, max: 3, step: 0.05, files: MULTI,
    unavailableReason: "Template ini hanya punya satu maskot (Claude).",
    anchor: { t: "array", name: "X", index: 1 }, anchorByFile: { "template-perang.html": { t: "array", name: "gx", index: 1 } } },
  { id: "gemini.x", label: "Gemini · posisi X", group: "Maskot", kind: "number", min: -3, max: 3, step: 0.05, files: ["template-trio.html"],
    unavailableReason: "Hanya template-trio yang punya maskot ketiga (Gemini).",
    anchor: { t: "array", name: "X", index: 2 } },
  { id: "claude.scale", label: "Claude · skala", group: "Maskot", kind: "number", min: 0.5, max: 1.3, step: 0.05, files: ["template-perang.html"],
    unavailableReason: "Hanya template-perang yang punya literal skala Claude (gs[0]); di template lain skala Claude = 1 implisit (tidak ada literalnya).",
    anchor: { t: "array", name: "gs", index: 0 } },
  { id: "codex.scale", label: "Codex · skala", group: "Maskot", kind: "number", min: 0.5, max: 1.3, step: 0.05, files: MULTI,
    unavailableReason: "Template ini hanya punya satu maskot; maskot tunggal tidak punya skala literal.",
    anchor: { t: "call", prefix: "dm.scale.setScalar(", index: 0 }, anchorByFile: { "template-perang.html": { t: "array", name: "gs", index: 1 } } },
  { id: "gemini.scale", label: "Gemini · skala", group: "Maskot", kind: "number", min: 0.5, max: 1.3, step: 0.05, files: ["template-trio.html"],
    unavailableReason: "Hanya template-trio yang punya maskot ketiga (Gemini).",
    anchor: { t: "call", prefix: "gm.scale.setScalar(", index: 0 } },
  { id: "claude.color", label: "Claude · warna aksen", group: "Warna", kind: "color", files: [...MULTI, ...SINGLE],
    unavailableReason: "",
    anchor: { t: "hex", prefix: "OR=M(0x" } },
  { id: "codex.color", label: "Codex · warna aksen", group: "Warna", kind: "color", files: MULTI,
    unavailableReason: "Template ini hanya punya satu maskot (Claude).",
    anchor: { t: "hex", prefix: "VI=M(0x" } },
  { id: "gemini.color", label: "Gemini · warna aksen", group: "Warna", kind: "color", files: ["template-trio.html"],
    unavailableReason: "Hanya template-trio yang punya maskot ketiga (Gemini).",
    anchor: { t: "hex", prefix: "lg=new THREE.SpotLight(0x" } },
  { id: "board.y", label: "Papan skor · tinggi (Y)", group: "Layar & Set", kind: "number", min: 2.5, max: 6.5, step: 0.1, files: MULTI,
    unavailableReason: "Template ini tidak punya papan skor.",
    anchor: { t: "call", prefix: "board.position.set(", index: 1 } },
  { id: "monitor.claude.x", label: "Monitor Claude · posisi X", group: "Layar & Set", kind: "number", min: -3, max: 3, step: 0.05, files: WITH_MON,
    unavailableReason: "Template ini tidak punya monitor ganda (mkMon); layarnya satu panel scr.",
    anchor: { t: "mkmon", index: 0 } },
  { id: "monitor.codex.x", label: "Monitor Codex · posisi X", group: "Layar & Set", kind: "number", min: -3, max: 3, step: 0.05, files: WITH_MON,
    unavailableReason: "Template ini tidak punya monitor ganda (mkMon).",
    anchor: { t: "mkmon", index: 1 } },
  { id: "monitor.gemini.x", label: "Monitor Gemini · posisi X", group: "Layar & Set", kind: "number", min: -3, max: 3, step: 0.05, files: ["template-trio.html"],
    unavailableReason: "Hanya template-trio yang punya monitor ketiga.",
    anchor: { t: "mkmon", index: 2 } },
  { id: "screen.x", label: "Layar · posisi X", group: "Layar & Set", kind: "number", min: -2, max: 2, step: 0.05, files: SINGLE,
    unavailableReason: "Template multi-maskot memakai monitor mkMon + papan skor, bukan satu panel scr.",
    anchor: { t: "call", prefix: "scr.position.set(", index: 0 } },
  { id: "screen.y", label: "Layar · tinggi (Y)", group: "Layar & Set", kind: "number", min: 1, max: 3, step: 0.05, files: SINGLE,
    unavailableReason: "Template multi-maskot memakai monitor mkMon + papan skor, bukan satu panel scr.",
    anchor: { t: "call", prefix: "scr.position.set(", index: 1 } },
  { id: "mug.x", label: "Mug · posisi X", group: "Layar & Set", kind: "number", min: -3, max: 3, step: 0.05, files: WITH_MUG,
    unavailableReason: "Template-meeting tidak punya mug di set-nya; template multi-maskot memakai set panggung berbeda.",
    anchor: { t: "call", prefix: "mug.position.set(", index: 0 } },
  { id: "window.x", label: "Jendela · posisi X", group: "Layar & Set", kind: "number", min: -4, max: 0, step: 0.05, files: SINGLE,
    unavailableReason: "Template multi-maskot memakai set panggung berbeda (dinding + papan skor).",
    anchor: { t: "call", prefix: "win.position.set(", index: 0 } },
  { id: "lamp.x", label: "Lampu · posisi X", group: "Layar & Set", kind: "number", min: -5, max: 5, step: 0.05, files: SINGLE,
    unavailableReason: "Template multi-maskot memakai lampu sorot per maskot, bukan satu lampu.",
    anchor: { t: "call", prefix: "lamp.position.set(", index: 0 } },
  // ---- Def array (cermin scripts/apply-edit.mjs — keduanya harus tetap sinkron) ----
  // Skor papan template-code: CL0/CL1/CX0/CX1 = [KEBERSIHAN, TES LULUS, PERFORMA].
  { id: "board.claude.start", label: "Papan · skor awal Claude [3]", group: "Papan skor", kind: "array", files: ["template-code.html"],
    unavailableReason: "Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1; template lain skornya dihitung (sinus / envelope / REM) atau tidak punya papan.",
    anchor: { t: "whole", name: "CL0" }, validate: (v) => boardScoreErr(v, "board.claude.start") },
  { id: "board.claude.final", label: "Papan · skor akhir Claude [3]", group: "Papan skor", kind: "array", files: ["template-code.html"],
    unavailableReason: "Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.",
    anchor: { t: "whole", name: "CL1" }, validate: (v) => boardScoreErr(v, "board.claude.final") },
  { id: "board.codex.start", label: "Papan · skor awal Codex [3]", group: "Papan skor", kind: "array", files: ["template-code.html"],
    unavailableReason: "Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.",
    anchor: { t: "whole", name: "CX0" }, validate: (v) => boardScoreErr(v, "board.codex.start") },
  { id: "board.codex.final", label: "Papan · skor akhir Codex [3]", group: "Papan skor", kind: "array", files: ["template-code.html"],
    unavailableReason: "Hanya template-code yang skor papannya literal CL0/CL1/CX0/CX1.",
    anchor: { t: "whole", name: "CX1" }, validate: (v) => boardScoreErr(v, "board.codex.final") },
  // Kurva tangki token kuota: keyframe [detik, persen] — ada reset (naik lagi ke 100).
  { id: "tank.curve", label: "Tangki token · kurva [detik, %]", group: "Papan skor", kind: "array", files: ["template-kuota.html"],
    unavailableReason: "Hanya template-kuota yang punya tangki token (RK).",
    anchor: { t: "whole", name: "RK" }, validate: (v, ctx) => tankCurveErr(v, ctx) },
  // Sticky notes rival: NT = [{f,to,a,b,o,r,tx}] (f 0=Claude/1=Codex, a/b jendela
  // terbang, o waktu sobek — 99 = tidak pernah sobek, tx 1-2 baris).
  { id: "rival.notes", label: "Rival · sticky notes", group: "Layar & Set", kind: "array", files: ["template-rival.html"],
    unavailableReason: "Hanya template-rival yang punya sticky notes terbang (NT).",
    anchor: { t: "whole", name: "NT" }, validate: (v, ctx) => rivalNotesErr(v, ctx) },
  // Perang: SP = [[waktu spawn Claude...],[waktu spawn Codex...]]; EV = baris
  // [pihak, mulai, ...] ketapel koin.
  { id: "war.spawns", label: "Perang · waktu spawn sub agent", group: "Perang", kind: "array", files: ["template-perang.html"],
    unavailableReason: "Hanya template-perang yang punya pasukan sub agent (SP).",
    anchor: { t: "whole", name: "SP" }, validate: (v, ctx) => warSpawnsErr(v, ctx) },
  { id: "war.catapults", label: "Perang · tembakan ketapel koin", group: "Perang", kind: "array", files: ["template-perang.html"],
    unavailableReason: "Hanya template-perang yang punya ketapel koin (EV).",
    anchor: { t: "whole", name: "EV" }, validate: (v, ctx) => warCatapultsErr(v, ctx) },
  // Jendela ketik + teks ketikan (bughunter/bomb/meeting): WIN dan TL harus
  // konsisten (jumlah baris sama; tiap jendela cukup untuk teksnya).
  { id: "typing.windows", label: "Ketik · jendela [[mulai, selesai]]", group: "Ketik", kind: "array", files: ["template-bughunter.html", "template-bomb.html", "template-meeting.html"],
    unavailableReason: "Template ini tidak punya jendela ketik WIN (typing/deploy mengetik dari drawScr inline; factor template tidak mengetik).",
    anchor: { t: "whole", name: "WIN" }, validate: (v, ctx) => typingWindowsErr(v, ctx) },
  { id: "typing.lines", label: "Ketik · baris ketikan [[...]]", group: "Ketik", kind: "array", files: ["template-bughunter.html", "template-bomb.html", "template-meeting.html"],
    unavailableReason: "Template ini tidak punya teks ketik TL.",
    anchor: { t: "whole", name: "TL" }, validate: (v, ctx) => typingLinesErr(v, ctx) },
  // Meeting: MEET_END=24.2 dipakai bersama timer + confetti + spin + layar.
  { id: "meeting.end", label: "Meeting · detik rapat selesai", group: "Ketik", kind: "number", min: 10, max: 32, step: 0.1, files: ["template-meeting.html"],
    unavailableReason: "Hanya template-meeting yang punya konstanta MEET_END.",
    anchor: { t: "assign", name: "MEET_END" } },
];

export const TYPE_CPS = 27; // huruf per detik di jendela ketik (SKILL.md)

/** Validator nilai untuk def 'array' baru. Kembalikan string error atau
 *  null. Cermin fungsi yang sama di scripts/apply-edit.mjs. */
export function boardScoreErr(v: unknown, id: string): string | null {
  if (!Array.isArray(v) || v.length !== 3) return `${id}: harus array 3 angka [KEBERSIHAN, TES LULUS, PERFORMA].`;
  for (const n of v) if (!Number.isInteger(n) || n < 0 || n > 100) return `${id}: tiap skor harus bilangan bulat 0..100 (dapat ${JSON.stringify(v)}).`;
  return null;
}
export function tankCurveErr(v: unknown, _ctx: { len: number }): string | null {
  if (!Array.isArray(v) || v.length < 2) return "tank.curve: harus array keyframe [[detik, persen], ...] minimal 2 baris.";
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 2 || !isNum(r[0]) || !isNum(r[1])) return `tank.curve[${i}]: harus [detik, persen].`;
    if (r[0] < 0) return `tank.curve[${i}]: detik ${r[0]} < 0.`;
    if (r[0] <= prev) return `tank.curve[${i}]: detik harus terurut naik ketat.`;
    if (r[1] < 0 || r[1] > 100) return `tank.curve[${i}]: persen ${r[1]} di luar 0..100.`;
    if (i === 0 && r[0] !== 0) return "tank.curve: keyframe pertama harus detik 0 (tangki mulai penuh).";
    prev = r[0];
  }
  return null;
}
export function rivalNotesErr(v: unknown, ctx: { len: number }): string | null {
  if (!Array.isArray(v)) return "rival.notes: harus array [{f,to,a,b,o,r,tx}, ...].";
  let prevA = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const n = v[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") return `rival.notes[${i}]: harus object {f,to,a,b,o,r,tx}.`;
    if (n.f !== 0 && n.f !== 1) return `rival.notes[${i}]: f harus 0 (Claude) atau 1 (Codex).`;
    if (!Array.isArray(n.to) || n.to.length !== 2 || !n.to.every(isNum)) return `rival.notes[${i}]: to harus [x, y] angka (posisi di monitor).`;
    if (!isNum(n.a) || !isNum(n.b) || !(0 <= (n.a as number) && (n.a as number) < (n.b as number) && (n.b as number) <= ctx.len)) return `rival.notes[${i}]: harus 0 <= a < b <= LEN (${ctx.len}).`;
    if ((n.a as number) < prevA) return `rival.notes[${i}]: a harus terurut naik.`;
    if (!isNum(n.o) || !((n.o as number) === 99 || (n.o as number) >= (n.b as number))) return `rival.notes[${i}]: o harus >= b, atau 99 (= tidak pernah sobek).`;
    if (!isNum(n.r)) return `rival.notes[${i}]: r harus angka (rotasi).`;
    if (!Array.isArray(n.tx) || n.tx.length < 1 || n.tx.length > 2 || !n.tx.every((s) => typeof s === "string" && s.length >= 1 && s.length <= 14)) return `rival.notes[${i}]: tx harus 1-2 string, tiap baris 1..14 karakter.`;
    prevA = n.a as number;
  }
  return null;
}
export function warSpawnsErr(v: unknown, ctx: { len: number }): string | null {
  if (!Array.isArray(v) || v.length !== 2) return "war.spawns: harus [[waktu...],[waktu...]] (satu array per pihak).";
  for (let s = 0; s < 2; s++) {
    const row = v[s];
    if (!Array.isArray(row) || row.length < 1 || row.length > 8) return `war.spawns[${s}]: harus 1..8 waktu spawn.`;
    let prev = -Infinity;
    for (const t of row) {
      if (!isNum(t) || t < 0 || t > ctx.len) return `war.spawns[${s}]: waktu ${t} di luar 0..LEN (${ctx.len}).`;
      if ((t as number) <= prev) return `war.spawns[${s}]: waktu harus terurut naik ketat.`;
      prev = t as number;
    }
  }
  return null;
}
export function warCatapultsErr(v: unknown, ctx: { len: number }): string | null {
  if (!Array.isArray(v)) return "war.catapults: harus array baris [pihak, mulai, ...] (6 angka).";
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 6 || !r.every(isNum)) return `war.catapults[${i}]: harus 6 angka [pihak, mulai, ...].`;
    if (r[0] !== 0 && r[0] !== 1) return `war.catapults[${i}]: pihak harus 0 (Claude) atau 1 (Codex).`;
    if (r[1] < 0 || r[1] > ctx.len) return `war.catapults[${i}]: mulai ${r[1]} di luar 0..LEN (${ctx.len}).`;
    if ((r[1] as number) <= prev) return `war.catapults[${i}]: mulai harus terurut naik ketat.`;
    prev = r[1] as number;
  }
  return null;
}
export function typingWindowsErr(v: unknown, ctx: { len: number }): string | null {
  if (!Array.isArray(v) || v.length === 0) return "typing.windows: harus array [[mulai, selesai], ...] tak kosong.";
  let prevEnd = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const w = v[i];
    if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `typing.windows[${i}]: harus [mulai, selesai].`;
    if (!(0 <= (w[0] as number) && (w[0] as number) < (w[1] as number) && (w[1] as number) <= ctx.len)) return `typing.windows[${i}]: harus 0 <= mulai < selesai <= LEN (${ctx.len}).`;
    if ((w[0] as number) < prevEnd) return `typing.windows[${i}]: tumpang tindih dengan jendela sebelumnya (jendela ketik harus disjoint).`;
    prevEnd = w[1] as number;
  }
  return null;
}
export function typingLinesErr(v: unknown, _ctx: { len: number }): string | null {
  if (!Array.isArray(v) || v.length === 0) return "typing.lines: harus array baris ketikan [[...], ...] tak kosong.";
  for (let i = 0; i < v.length; i++) {
    const row = v[i];
    if (!Array.isArray(row) || row.length < 1 || row.length > 4) return `typing.lines[${i}]: harus 1..4 string per jendela.`;
    for (const s of row) {
      if (typeof s !== "string" || !s.length || s.length > 200) return `typing.lines[${i}]: tiap baris harus string 1..200 karakter.`;
    }
  }
  return null;
}

export type PropValue = number | string | unknown[];
export type PropValues = Record<string, PropValue>;

/** Satu entri props bentuk array (alias lama — lihat komentar format spec
 *  di atas). */
export interface PropEntry {
  id: string;
  value: PropValue;
}
/** Input props yang diterima setProps/validateProps/applyEdits: object map
 *  (kanonik) atau array [{id, value}] (alias). */
export type PropsInput = PropValues | PropEntry[];

/** Normalisasi props ke object map. Bentuk array: duplikat id / entri
 *  bukan {"id","value"} = throw (pemanggil CLI mengubahnya jadi fail).
 *  Cermin normalizeProps() di scripts/apply-edit.mjs. */
export function normalizeProps(raw: unknown): PropValues {
  if (raw === undefined) return {};
  if (Array.isArray(raw)) {
    const out: PropValues = {};
    for (const p of raw as PropEntry[]) {
      if (!p || typeof p !== "object" || typeof p.id !== "string" || !("value" in p))
        throw new Error(`props array: tiap entri harus {"id":"...","value":...} (dapat ${JSON.stringify(p)})`);
      if (p.id in out) throw new Error(`props array: id "${p.id}" muncul dua kali`);
      out[p.id] = p.value;
    }
    return out;
  }
  if (raw && typeof raw === "object") return { ...(raw as PropValues) };
  throw new Error('props harus array [{"id","value"}] atau object {"id": value}');
}

export interface ParsedProp {
  def: PropDef;
  available: boolean;
  value?: PropValue;
  reason?: string;
}

/** Baca semua prop registry dari HTML template + file-nya. */
export function parseProps(html: string, file: string): ParsedProp[] {
  return PROP_DEFS.map((def) => {
    if (!def.files.includes(file)) return { def, available: false, reason: def.unavailableReason };
    const v = readProp(html, def, file);
    if (v === null) return { def, available: false, reason: "Pola literal tidak ditemukan di template ini." };
    return { def, available: true, value: v };
  });
}

function anchorFor(def: PropDef, file: string): PropAnchor {
  return (def.anchorByFile && def.anchorByFile[file]) || def.anchor;
}

/** Baca satu nilai prop dari HTML (null bila anchor tidak ketemu). */
export function readProp(html: string, def: PropDef, file: string): PropValue | null {
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
    // Seluruh array (RK/EV/SP/NT/WIN/TL/CL0/...): kembalikan nilai ter-parse.
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    return Array.isArray(v) ? (v as PropValue) : null;
  }
  if (a.t === "assign") {
    // Satu angka `NAME=...` (MEET_END).
    const re = new RegExp("\\b" + a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*(-?[\\d.]+)");
    const m = re.exec(html);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return Number.isFinite(v) ? v : null;
  }
  // mkmon: panggilan ke-index (definisi `mkMon=(x,fn,col)` dilewati)
  const re = /mkMon\((-?[\d.]+),\(g/g;
  const found: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.push(parseFloat(m[1]));
  const v = found[a.index];
  return v !== undefined && Number.isFinite(v) ? v : null;
}

/** Tulis satu nilai prop ke HTML. ok=false bila anchor tidak ditemukan. */
export function setProp(html: string, def: PropDef, file: string, value: PropValue): EditResult {
  const a = anchorFor(def, file);
  if (a.t === "array") {
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    const v = parseJsArray(html.slice(span.start, span.end));
    if (!Array.isArray(v)) return { html, ok: false };
    const next = [...v];
    next[a.index] = typeof value === "number" ? Math.round(value * 1000) / 1000 : value;
    const ser = "[" + next.map((x) => (typeof x === "string" ? JSON.stringify(x) : numFmt(x as number))).join(",") + "]";
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
    // Seluruh array diganti utuh (JSON.stringify — sama seperti .mjs).
    const span = findArraySpan(html, a.name);
    if (!span) return { html, ok: false };
    return { html: html.slice(0, span.start) + JSON.stringify(value) + html.slice(span.end), ok: true };
  }
  if (a.t === "assign") {
    // Satu angka `NAME=...` (MEET_END).
    if (typeof value !== "number" || !Number.isFinite(value)) return { html, ok: false };
    const re = new RegExp("(\\b" + a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*)(-?[\\d.]+)");
    if (!re.test(html)) return { html, ok: false };
    return { html: html.replace(re, (_m, p) => p + numFmt(value)), ok: true };
  }
  const re = /mkMon\((-?[\d.]+),\(g/g;
  const found: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.push({ start: m.index + "mkMon(".length, end: m.index + "mkMon(".length + m[1].length });
  const hit = found[a.index];
  if (!hit || typeof value !== "number") return { html, ok: false };
  return { html: html.slice(0, hit.start) + numFmt(value) + html.slice(hit.end), ok: true };
}

/** Terapkan banyak prop sekaligus. Warna aksen juga menyinkronkan CC[i]
 *  (warna bubble caption: 0=Claude, 1=Codex, 2=Gemini) bila array CC ada.
 *  Menerima object map (kanonik) maupun array [{id,value}] (alias). */
export function setProps(html: string, file: string, propsIn: PropsInput): { html: string; ok: boolean; failed: string[] } {
  const props = normalizeProps(propsIn);
  let h = html;
  const failed: string[] = [];
  for (const def of PROP_DEFS) {
    if (!(def.id in props)) continue;
    const r = setProp(h, def, file, props[def.id]);
    if (!r.ok) {
      failed.push(def.id);
      continue;
    }
    h = r.html;
  }
  // Sinkron CC: warna aksen -> warna bubble caption speaker yang sama.
  const ccSync: Record<string, number> = { "claude.color": 0, "codex.color": 1, "gemini.color": 2 };
  for (const [id, idx] of Object.entries(ccSync)) {
    if (!(id in props) || typeof props[id] !== "string") continue;
    const span = findArraySpan(h, "CC");
    if (!span) continue;
    const v = parseJsArray(h.slice(span.start, span.end));
    if (!Array.isArray(v) || idx >= v.length) continue;
    const next = [...v];
    next[idx] = props[id];
    h = h.slice(0, span.start) + "[" + next.map((x) => JSON.stringify(x)).join(",") + "]" + h.slice(span.end);
  }
  return { html: h, ok: failed.length === 0, failed };
}

/** Validasi silang antar prop array (cermin crossCheckFinal() di
 *  apply-edit.mjs, yang memeriksanya pada HTML AKHIR): WIN/TL harus
 *  konsisten (jumlah sama; tiap jendela cukup untuk teksnya pada 27
 *  huruf/detik) dan meeting.end harus sesudah jendela ketik terakhir.
 *  Hanya berjalan bila prop yang bersangkutan ada di `props`.
 *  Sengaja TERPISAH dari validateProps() — di .mjs pun cek silang ini
 *  bukan bagian validateProps(), melainkan crossCheckFinal(). UI Studio
 *  memanggil keduanya supaya Terapkan tetap terblokir bila WIN/TL tidak
 *  konsisten. */
export function crossCheckProps(props: PropValues, len: number): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const win = props["typing.windows"];
  const lines = props["typing.lines"];
  if (Array.isArray(win) && Array.isArray(lines)) {
    if (win.length !== lines.length)
      errors.push(`typing: jumlah jendela WIN (${win.length}) != jumlah baris TL (${lines.length}) — tiap jendela butuh tepat satu baris ketikan.`);
    win.forEach((w, i) => {
      const row = lines[i];
      if (!Array.isArray(w) || !Array.isArray(row)) return;
      const chars = (row as unknown[]).reduce<number>((a, s) => a + String(s).length, 0);
      const dur = (w[1] as number) - (w[0] as number);
      if (!Number.isFinite(dur)) return;
      if (dur < chars / TYPE_CPS)
        errors.push(`typing jendela #${i + 1}: ${chars} huruf butuh ${(chars / TYPE_CPS).toFixed(1)} dtk pada ${TYPE_CPS} huruf/detik, jendela hanya ${dur.toFixed(1)} dtk — teks akan terpotong.`);
      else if (dur < chars / TYPE_CPS + 0.3)
        warnings.push(`typing jendela #${i + 1}: ${dur.toFixed(1)} dtk — mepet untuk ${chars} huruf (butuh ~${(chars / TYPE_CPS + 0.3).toFixed(1)} dtk).`);
    });
  }
  const end = props["meeting.end"];
  if (typeof end === "number" && Array.isArray(win) && win.length) {
    const lastWin = Math.max(...win.map((w) => (Array.isArray(w) && isNum(w[1]) ? (w[1] as number) : -Infinity)));
    if (Number.isFinite(lastWin) && end <= lastWin)
      errors.push(`meeting.end ${end} harus sesudah jendela ketik terakhir (${lastWin}) — timer/confetti/layar baca MEET_END yang sama.`);
  }
  void len;
  return { errors, warnings };
}

/** Validasi props: spacing antar maskot (SKILL.md: gap bahu >0.1, monitor
 *  2.4 butuh jarak pusat >=2.6), framing |x|<=3.2, rentang tiap prop,
 *  validator per-def untuk prop array, plus validasi silang WIN/TL dan
 *  meeting.end. Menerima object map maupun array [{id,value}].
 *  `len` = durasi template (LEN); bila 0, validator yang butuh LEN
 *  (rival.notes, war.*, typing.windows) memakai 0 — pemanggil UI/CLI
 *  harus mengisi LEN yang benar. Perilaku SAMA dengan validateProps() di
 *  scripts/apply-edit.mjs (cek silang WIN/TL + meeting.end ada di
 *  crossCheckProps(), bukan di sini — seperti crossCheckFinal() di .mjs). */
export function validateProps(propsIn: PropsInput, file: string, len = 0): Validation {
  const props = normalizeProps(propsIn);
  const errors: string[] = [];
  const warnings: string[] = [];
  const xs: { id: string; v: number }[] = [];
  for (const id of ["claude.x", "codex.x", "gemini.x"]) {
    const v = props[id];
    if (typeof v === "number") {
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
    if (def.kind === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        errors.push(`${def.id}: harus angka.`);
        continue;
      }
      if (def.min !== undefined && v < def.min) errors.push(`${def.id}: ${v} < batas ${def.min}.`);
      if (def.max !== undefined && v > def.max) errors.push(`${def.id}: ${v} > batas ${def.max}.`);
    } else if (def.kind === "color") {
      if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`${def.id}: warna harus format #rrggbb.`);
    }
    // kind 'array': divalidasi def.validate di bawah, bukan di sini.
    if (typeof def.validate === "function") {
      const e = def.validate(v, { len });
      if (e) errors.push(e);
    }
  }
  // Monitor jangan jauh dari maskotnya (kecuali perang: tanpa mkMon).
  const pairs: [string, string][] = [["monitor.claude.x", "claude.x"], ["monitor.codex.x", "codex.x"], ["monitor.gemini.x", "gemini.x"]];
  for (const [mon, mas] of pairs) {
    const a = props[mon];
    const b = props[mas];
    if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) > 0.8)
      warnings.push(`${mon} (${a}) jauh dari ${mas} (${b}) — monitor dan maskot tidak sejajar.`);
  }
  void file;
  return { errors, warnings };
}

/** Spec edit kanonik — lihat komentar di atas (format dipakai Studio,
 *  apply-edit.mjs, dan export.mjs --edit). */
export interface EditSpec {
  file: string;
  title?: string;
  sub?: string;
  end?: string;
  caps?: Cap[];
  shots?: Shot[];
  vo?: string[];
  /** Object map (kanonik) atau array [{id,value}] (alias lama). */
  props?: PropsInput;
}

export interface ApplyResult {
  html: string;
  ok: boolean;
  applied: string[];
  failed: string[];
  /** true bila VO mengikuti teks caps (literal diganti / turunan otomatis). */
  voFollowedCaps: boolean;
}

/** Terapkan satu spec lengkap ke HTML template. Urutan: teks, caps, shots,
 *  VO (ikuti caps bila vo tidak diisi), props. */
export function applyEdits(html: string, spec: EditSpec, len: number): ApplyResult {
  let h = html;
  const applied: string[] = [];
  const failed: string[] = [];
  let voFollowedCaps = false;
  const text: Partial<TextFields> = {};
  if (spec.title !== undefined) text.title = spec.title;
  if (spec.sub !== undefined) text.sub = spec.sub;
  if (spec.end !== undefined) text.end = spec.end;
  if (Object.keys(text).length) {
    h = setText(h, text);
    applied.push("text");
  }
  if (spec.caps) {
    const r = setCaps(h, spec.caps);
    h = r.html;
    if (r.ok) applied.push("caps");
    else failed.push("caps");
  }
  if (spec.shots) {
    const r = setShots(h, spec.shots);
    h = r.html;
    if (r.ok) applied.push("shots");
    else failed.push("shots");
  }
  if (spec.vo) {
    const r = setVO(h, spec.vo);
    h = r.html;
    if (r.ok) applied.push("vo");
    else failed.push("vo");
  } else if (spec.caps) {
    const kind = voKind(h);
    if (kind === "literal") {
      const r = setVO(h, spec.caps.map((c) => c[2]));
      h = r.html;
      if (r.ok) {
        applied.push("vo");
        voFollowedCaps = true;
      } else failed.push("vo");
    } else if (kind === "derived") {
      // VO=caps.map(c=>c[2]) — sudah mengikuti caps otomatis.
      voFollowedCaps = true;
    }
  }
  if (spec.props && (Array.isArray(spec.props) ? spec.props.length : Object.keys(spec.props).length)) {
    const normalized = normalizeProps(spec.props);
    const r = setProps(h, spec.file, normalized);
    h = r.html;
    if (r.ok) applied.push("props");
    else failed.push(...r.failed.map((id) => "props:" + id));
  }
  void len;
  return { html: h, ok: failed.length === 0, applied, failed, voFollowedCaps };
}

/**
 * Bridge yang disuntikkan sebelum </body> — SAMA PERSIS dengan studio vanilla.
 * Mengekspos window.__st { gT, seek, play, pause, len, caps, shots, mute, ok }
 * dan menyembunyikan chrome player bawaan template (#go / #gui).
 * Template tidak diubah di disk; bridge hanya ada di string srcdoc.
 */
export const BRIDGE = `<script>try{
(function(){
var q=document.getElementById('gui'),g=document.getElementById('go');
if(q)q.style.display='none';if(g)g.style.display='none';
function ss(){return typeof syn!=='undefined'?syn:null}
window.__st={
gT:function(){return T},
seek:function(t){
  var wasPlaying=!paused,S=ss();
  T=Math.max(0,Math.min(LEN,t));
  if(S)S.cancel();
  try{vLast=-1}catch(e){}
  renderAt(T);
  paused=!wasPlaying;
  if(!wasPlaying){try{vOn=false}catch(e){}}
},
pause:function(){paused=true;try{vOn=false}catch(e){};var S=ss();if(S)S.cancel()},
play:function(){try{vOn=true;vLast=-1}catch(e){};paused=false},
len:function(){return LEN},
caps:function(){return caps},shots:function(){return shots},
mute:function(m){try{vMute=m}catch(e){};var S=ss();if(S){if(m)S.cancel();else try{vLast=-1}catch(e){}}},
ok:function(){return typeof renderAt==='function'&&typeof LEN==='number'}};
})();
}catch(e){window.__stErr=String(e)}<\/script>`;
