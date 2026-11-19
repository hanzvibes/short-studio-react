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
 * ============ VENDOR three.js (preview) ============
 * 12 template memuat three.js r128 dari CDN (1 file cdnjs + 12 file
 * jsdelivr, 13 script tag per template). CDN itu tidak selalu bisa
 * dijangkau — di lingkungan tanpa internet preview 3D mati total
 * ("THREE is not defined"). Karena itu 13 file yang sama di-vendor ke
 * `public/vendor/` (flat, nama file sama; lihat README.md "Vendor
 * three.js" untuk daftar + hash sha256 + cara update).
 *
 * `rewriteThreeCdnToLocal` menukar 13 URL CDN itu dengan `/vendor/<nama>`
 * KHUSUS UNTUK PREVIEW di Studio (srcdoc iframe) — urutan script tetap
 * sama seperti aslinya. Satu-satunya pemanggil: `mount()` di
 * components/Studio.tsx, yang dilewati SEMUA jalur preview (template
 * asli, edit tersimpan, "Video Buatan Saya").
 *
 * JANGAN dipakai untuk export: `applyEdits` (dipakai `downloadMine` di
 * Studio.tsx dan `scripts/export.mjs`) SENGAJA tidak me-rewrite —
 * file .html hasil unduh harus tetap standalone dan jalan di browser
 * normal, jadi tetap pakai URL CDN. Pemisahan: preview = rewrite lokal,
 * export = CDN asli. (Pola yang sama dipakai claudeku-studio.)
 *
 * Google Fonts (Plus Jakarta Sans) SENGAJA tetap CDN dan tidak
 * di-rewrite: font hanya soal tampilan — tanpa internet teks jatuh ke
 * font sistem dan video tetap jalan, tidak seperti three.js yang fatal.
 */
export const CDN_THREE_MAIN =
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
export const CDN_THREE_EXAMPLES_PREFIX =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/";

/** Jumlah script three.js CDN yang dikenali di sebuah HTML. */
export function countCdnThreeScripts(html: string): number {
  const main = html.includes(CDN_THREE_MAIN) ? 1 : 0;
  const examples = html.split(CDN_THREE_EXAMPLES_PREFIX).length - 1;
  return main + examples;
}

/**
 * Tukar 13 URL CDN three.js r128 dengan /vendor/<basename>.
 * Mengembalikan { html, replaced } — replaced harus 13 untuk template
 * canonical; bila 0, HTML bukan template three.js yang dikenal.
 * Hanya menyentuh URL script three.js; font Google, konten, dan urutan
 * script lainnya tidak diubah.
 */
export function rewriteThreeCdnToLocal(html: string): { html: string; replaced: number } {
  let replaced = 0;
  let out = html;
  if (out.includes(CDN_THREE_MAIN)) {
    out = out.split(CDN_THREE_MAIN).join("/vendor/three.min.js");
    replaced += 1;
  }
  out = out.replace(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/examples\/js\/(?:shaders|postprocessing)\/([A-Za-z0-9]+\.js)/g,
    (_m, file: string) => {
      replaced += 1;
      return `/vendor/${file}`;
    },
  );
  return { html: out, replaced };
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
      errors.push(`Caption #${n}: pengisi suara harus 0, 1, atau 2.`);
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
    (["kamera", "arah pandang"] as const).forEach((what, k) => {
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
  | { t: "assign"; name: string }
  | { t: "const-sites"; name: string; before: string; default: number | number[]; sites: Site[]; also?: ConstRef[]; index?: number; sitesByFile?: Record<string, Site[]>; defaultByFile?: Record<string, number | number[]> }
  | { t: "assign-sites"; name: string; sites: Site[] }
  | { t: "inject-call"; after: string; text: string; prefix: string; index: number; default: number }
  | { t: "const-line"; name: string; before: string; default: number; after: string; insertText: string; insertAfter: string }
  | { t: "str"; name: string }
  | { t: "args-list"; prefix: string }
  | { t: "two-whole"; names: [string, string] }
  | { t: "block"; start: string; end: string }
  | { t: "chat" }
  | { t: "fort-field"; side: 0 | 1; field: "text" | "color" }
  | { t: "num-between"; before: string; after: string };

export interface PropDef {
  id: string;
  label: string;
  /** Kunci objek (lihat OBJECTS) — untuk pemilih objek di UI. */
  obj: string;
  /** Label awam untuk kontrol ini ("Geser kiri-kanan"). */
  plain: string;
  /** Satu kalimat penjelasan awam. */
  hint?: string;
  /** Jenis kontrol khusus di UI (choice/scores/curve/windows/spawns/...). */
  control?: string;
  /** Satuan yang ditampilkan (detik/×/poin/...). */
  unit?: string;
  /** Rentang berbeda per template. */
  rangeByFile?: Record<string, { min: number; max: number; step: number }>;
  group: string;
  kind: "number" | "color" | "array" | "text";
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
  validate?: (v: unknown, ctx: { len: number }, id: string) => string | null;
}

const MULTI = ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html", "template-perang.html"];
const SINGLE = ["template-typing.html", "template-deploy.html", "template-bughunter.html", "template-bomb.html", "template-meeting.html", "template-sleep.html"];
const WITH_MON = ["template.html", "template-code.html", "template-kuota.html", "template-rival.html", "template-trio.html"];
const WITH_MUG = ["template-typing.html", "template-deploy.html", "template-bughunter.html", "template-bomb.html", "template-sleep.html"];

export const PROP_DEFS: PropDef[] = [
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
          // U3 audit-500: penyebut (T_DEFUSE-T_ALARM-.2) — hitung mundur
          // mencapai 00:01 tepat 0,2 dtk SEBELUM bom jinak, seperti rumus
          // asli (29/1.4216 = 20,4 = (23.4-2.8)-0.2; 0,2 = setengah lebar
          // jendela transisi jinak T_DEFUSE±0.2 di beat.defuse). Tanpa -.2,
          // RM baru = 1 tepat di T_DEFUSE, saat cdS sudah 'AMAN' — 00:01
          // mustahil tampil walau T_ALARM sudah benar.
          "const RM=t=>t<T_ALARM?CD0:Math.max(1,CD0-Math.floor((t-T_ALARM)*(CD0-1)/(T_DEFUSE-T_ALARM-.2))),cdS=t=>t>=T_DEFUSE?'AMAN':'00:'+String(RM(t)).padStart(2,'0');"
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
      "defaultByFile": { "template-trio.html": 12 },
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
      // U3 audit-500: alarm asli Bom 2,8 (bukan 2) — dibaca dari literal
      // template-bomb.html sendiri (baris RM `t<2.8`, komentar hitung
      // mundur, dan situs `ss(t,2.8,...)`). Default bersama 2 milik
      // Bug Hunter; tanpa defaultByFile ini, beat.alarm yang diterapkan
      // sesudah bomb.seconds menimpa T_ALARM 2.8 -> 2 (ensureConst
      // menulis ulang) dan timer mulai berdetak di t=2,0.
      "defaultByFile": { "template-bomb.html": 2.8 },
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

export const TYPE_CPS = 27; // huruf per detik di jendela ketik (SKILL.md)

/** Validator nilai untuk def array/teks. Kembalikan pesan error (diawali
 *  id pengaturan, supaya UI bisa menaruhnya di baris yang benar) atau null.
 *  Pesan memakai bahasa sehari-hari, tanpa istilah dalam. */
export function boardScoreErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length !== 3) return `${id}: harus 3 angka.`;
  for (const n of v) if (!Number.isInteger(n) || n < 0 || n > 100) return `${id}: tiap angka harus bilangan bulat 0..100 (dapat ${JSON.stringify(v)}).`;
  return null;
}
export function tankCurveErr(v: unknown, _ctx: { len: number }, id: string): string | null {
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
export function rivalNotesErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v)) return `${id}: harus daftar catatan.`;
  let prevA = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const n = v[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") return `${id} catatan ${i + 1}: isinya tidak lengkap.`;
    if (n.f !== 0 && n.f !== 1) return `${id} catatan ${i + 1}: pengirim harus maskot oranye atau biru.`;
    if (!Array.isArray(n.to) || n.to.length !== 2 || !n.to.every(isNum)) return `${id} catatan ${i + 1}: tujuan harus [kiri-kanan, tinggi].`;
    if (!isNum(n.a) || !isNum(n.b) || !(0 <= (n.a as number) && (n.a as number) < (n.b as number) && (n.b as number) <= ctx.len)) return `${id} catatan ${i + 1}: waktunya harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
    if ((n.a as number) < prevA) return `${id} catatan ${i + 1}: waktu mulai harus naik terus.`;
    if (!isNum(n.o) || !((n.o as number) === 99 || (n.o as number) >= (n.b as number))) return `${id} catatan ${i + 1}: waktu sobek harus sesudah selesai, atau 99 (= tidak pernah sobek).`;
    if (!isNum(n.r)) return `${id} catatan ${i + 1}: putaran harus angka.`;
    if (!Array.isArray(n.tx) || n.tx.length < 1 || n.tx.length > 2 || !n.tx.every((s) => typeof s === "string" && s.length >= 1 && s.length <= 14)) return `${id} catatan ${i + 1}: tulisannya harus 1-2 baris, tiap baris 1..14 huruf.`;
    prevA = n.a as number;
  }
  return null;
}
export function warSpawnsErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length !== 2) return `${id}: harus dua daftar waktu (satu per pihak).`;
  for (let s = 0; s < 2; s++) {
    const row = v[s];
    if (!Array.isArray(row) || row.length < 1 || row.length > 8) return `${id} pihak ${s + 1}: harus 1..8 waktu muncul.`;
    let prev = -Infinity;
    for (const t of row) {
      if (!isNum(t) || t < 0 || t > ctx.len) return `${id} pihak ${s + 1}: waktu ${t} di luar 0..durasi video (${ctx.len} detik).`;
      if ((t as number) <= prev) return `${id} pihak ${s + 1}: waktu harus naik terus.`;
      prev = t as number;
    }
  }
  return null;
}
export function warCatapultsErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v)) return `${id}: harus daftar tembakan.`;
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 6 || !r.every(isNum)) return `${id} tembakan ${i + 1}: harus 6 angka.`;
    if (r[0] !== 0 && r[0] !== 1) return `${id} tembakan ${i + 1}: pihak harus maskot oranye atau biru.`;
    if (r[1] < 0 || r[1] > ctx.len) return `${id} tembakan ${i + 1}: waktu mulai ${r[1]} di luar 0..durasi video (${ctx.len} detik).`;
    if ((r[1] as number) <= prev) return `${id} tembakan ${i + 1}: waktu mulai harus naik terus.`;
    prev = r[1] as number;
  }
  return null;
}
export function typingWindowsErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar [mulai, selesai] yang tidak kosong.`;
  let prevEnd = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const w = v[i];
    if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `${id} baris ${i + 1}: harus [mulai, selesai].`;
    if (!(0 <= (w[0] as number) && (w[0] as number) < (w[1] as number) && (w[1] as number) <= ctx.len)) return `${id} baris ${i + 1}: harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
    if ((w[0] as number) < prevEnd) return `${id} baris ${i + 1}: waktunya tumpang tindih dengan baris sebelumnya.`;
    prevEnd = w[1] as number;
  }
  return null;
}
export function typingLinesErr(v: unknown, _ctx: { len: number }, id: string): string | null {
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
export function screenCodeErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar teks yang tidak kosong.`;
  for (let i = 0; i < v.length; i++) {
    const s = v[i];
    if (typeof s !== "string" || !s.length || s.length > 200) return `${id} baris ${i + 1}: tiap baris harus teks 1..200 huruf.`;
  }
  return null;
}
export function screenFixErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (typeof v !== "string" || !v.length || v.length > 200) return `${id}: harus teks 1..200 huruf.`;
  return null;
}
export function screenPromptErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (typeof v !== "string" || !v.length || v.length > 80) return `${id}: harus teks 1..80 huruf.`;
  return null;
}
export function screenRecentErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 6) return `${id}: harus 1..6 baris.`;
  for (let i = 0; i < v.length; i++) {
    const s = v[i];
    if (typeof s !== "string" || !s.length || s.length > 30) return `${id} baris ${i + 1}: tiap baris harus teks 1..30 huruf.`;
  }
  return null;
}
export function screenPipelineErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length !== 2) return `${id}: harus dua daftar tahapan (sebelum gagal dan sesudah perbaikan).`;
  for (let k = 0; k < 2; k++) {
    const run = v[k];
    if (!Array.isArray(run) || run.length === 0) return `${id} daftar ${k + 1}: harus ada minimal satu tahap.`;
    let prevEnd = -Infinity;
    for (let i = 0; i < run.length; i++) {
      const w = run[i];
      if (!Array.isArray(w) || w.length !== 2 || !isNum(w[0]) || !isNum(w[1])) return `${id} daftar ${k + 1} tahap ${i + 1}: harus [mulai, selesai].`;
      if (!(0 <= (w[0] as number) && (w[0] as number) < (w[1] as number) && (w[1] as number) <= ctx.len)) return `${id} daftar ${k + 1} tahap ${i + 1}: harus 0 <= mulai < selesai <= durasi video (${ctx.len} detik).`;
      if ((w[0] as number) < prevEnd) return `${id} daftar ${k + 1} tahap ${i + 1}: waktunya tumpang tindih dengan tahap sebelumnya.`;
      prevEnd = w[1] as number;
    }
  }
  return null;
}
export function screenChatErr(v: unknown, ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length === 0) return `${id}: harus daftar obrolan yang tidak kosong.`;
  let prev = -Infinity;
  for (let i = 0; i < v.length; i++) {
    const r = v[i];
    if (!Array.isArray(r) || r.length !== 4) return `${id} baris ${i + 1}: harus [detik, nama, pesan, warna].`;
    if (!isNum(r[0]) || (r[0] as number) < 0 || (r[0] as number) > ctx.len) return `${id} baris ${i + 1}: detik harus 0..durasi video (${ctx.len} detik).`;
    if ((r[0] as number) < prev) return `${id} baris ${i + 1}: detik harus naik terus.`;
    if (typeof r[1] !== "string" || !r[1].length || r[1].length > 12) return `${id} baris ${i + 1}: nama harus 1..12 huruf.`;
    if (typeof r[2] !== "string" || !r[2].length || r[2].length > 80) return `${id} baris ${i + 1}: pesan harus 1..80 huruf.`;
    if (typeof r[3] !== "string" || !CHAT_COLORS.includes(r[3])) return `${id} baris ${i + 1}: warna harus salah satu dari ${CHAT_COLORS.join(", ")}.`;
    prev = r[0] as number;
  }
  return null;
}
export function screenEditorErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (typeof v !== "string" || !v.trim()) return `${id}: isinya tidak boleh kosong.`;
  if (!v.includes("[FN")) return `${id}: isinya harus memuat 4 bagian cerita (dimulai dengan baris judul).`;
  const open = (v.match(/\[/g) || []).length;
  const close = (v.match(/\]/g) || []).length;
  if (open !== close) return `${id}: kurung bukanya tidak seimbang — ada baris yang belum ditutup.`;
  if (!v.includes("t<13") || !v.includes("t<18.6")) return `${id}: batas antar bagiannya harus tetap ada (sebelum alarm, konflik, sesudah hapus tanda, beres).`;
  return null;
}
export function fortTextErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (typeof v !== "string" || !v.length || v.length > 12) return `${id}: harus teks 1..12 huruf.`;
  if (v.includes("'") || v.includes('"')) return `${id}: tidak boleh memakai tanda kutip.`;
  return null;
}
export function warButtonErr(v: unknown, _ctx: { len: number }, id: string): string | null {
  if (!Array.isArray(v) || v.length !== 4) return `${id}: harus 4 warna.`;
  for (let i = 0; i < 4; i++) {
    const c = v[i];
    if (!Array.isArray(c) || c.length !== 3 || !c.every((n) => isNum(n) && (n as number) >= 0 && (n as number) <= 1))
      return `${id} warna ${i + 1}: harus 3 angka 0..1.`;
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
/** Nilai bawaan anchor const-sites untuk satu file: per-file bila ada
 *  (defaultByFile), kalau tidak default bersama. Dipakai readProp saat
 *  konstanta belum ada di template asli — nilai asli tiap template bisa
 *  beda (mis. beat trio/deploy/rival; U1 audit-500: default bersama
 *  Versus/typing di luar rentang per-file trio/deploy/rival). */
function anchorDefault(a: Extract<PropAnchor, { t: "const-sites" }>, file: string): number | number[] {
  const d = a.defaultByFile?.[file];
  return d !== undefined ? d : a.default;
}

/** Satu situs pengganti teks: pasangan [cari, ganti]; tiap sisi boleh
 *  berupa satu string atau daftar alternatif yang berpasangan (alternatif
 *  pertama diganti yang pertama, dst.). Bila yang dicari tidak ditemukan
 *  tapi hasil gantinya sudah ada, situs dianggap sudah diterapkan. */
export type Site = [string | string[], string | string[]];
/** Konstanta bernama lain yang harus ikut disisipkan (rujukan silang antar
 *  pengaturan, mis. rumus yang membaca konstanta momen lain). */
export interface ConstRef { name: string; before: string; default: number }
export interface Range { min: number; max: number; step: number }
export interface JsStringSpan { value: string; start: number; end: number }
export interface NumSpan { start: number; end: number }
export interface XPos { id: string; v: number }

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const constNumRe = (name: string): RegExp => new RegExp("(\\b" + escRe(name) + "\\s*=\\s*)(-?[\\d.]+)");
function findConstNum(html: string, name: string): number | null {
  const m = constNumRe(name).exec(html);
  if (!m) return null;
  const v = parseFloat(m[2]);
  return Number.isFinite(v) ? v : null;
}
function findConstArray(html: string, name: string): number[] | null {
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
function insertAtScriptTop(html: string, marker: string, line: string): EditResult {
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
function injectedConstLine(html: string, name: string, valPat: string): { start: number; end: number } | null {
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
function ensureConst(html: string, name: string, before: string, value: number | number[]): EditResult {
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
function ensureConstDefault(html: string, ref: ConstRef): EditResult {
  if (findConstNum(html, ref.name) !== null) return { html, ok: true };
  return insertAtScriptTop(html, ref.before, "const " + ref.name + "=" + numFmt(ref.default) + ";");
}
/** Terapkan daftar situs pengganti (J4/J5). Tiap situs: cari alternatif
 *  pertama yang ada lalu ganti SEMUA kemunculannya; bila tidak ada yang
 *  cocok tapi hasil pengganti sudah ada, lewati; bila keduanya tidak ada,
 *  gagal (jangan tulis setengah). */
function applySites(html: string, sites: Site[]): EditResult {
  let h = html;
  for (const site of sites) {
    const searches: string[] = Array.isArray(site[0]) ? site[0] : [site[0]];
    const reps: string[] = Array.isArray(site[1]) ? site[1] : [site[1]];
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
function parseJsStringAt(html: string, i: number): JsStringSpan | null {
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
const jsSingle = (s: string): string => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
/** Warna balon obrolan yang dipakai template-meeting (nama, bukan kode). */
const CHAT_COLORS = ["ORG", "BLU", "YEL", "GRN", "RED"];
/** Parse array CHAT (baris [detik, nama, pesan, WARNA]) — warnanya nama
 *  (ORG/BLU/...) tanpa kutip, jadi parser literal biasa tidak bisa. */
function parseChat(html: string): unknown[] | null {
  const span = findArraySpan(html, "CHAT");
  if (!span) return null;
  const src = html.slice(span.start, span.end);
  let i = 0;
  const skip = (): void => { while (i < src.length && /\s/.test(src[i])) i++; };
  const parseStr = (): string | null => {
    const r = parseJsStringAt(src, i);
    if (!r) return null;
    i = r.end;
    return r.value;
  };
  const parseVal = (): unknown => {
    skip();
    const c = src[i];
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
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
const chatToJs = (rows: unknown[]): string => "[" + (rows as unknown[][]).map((r) =>
  "[" + numFmt(r[0] as number) + "," + JSON.stringify(r[1]) + "," + JSON.stringify(r[2]) + "," +
  (typeof r[3] === "string" && CHAT_COLORS.includes(r[3]) ? r[3] : JSON.stringify(r[3])) + "]").join(",") + "]";
function fortRe(side: number): RegExp {
  return new RegExp("f" + (side === 0 ? "A" : "B") + "=mkFort\\(" + (side === 0 ? "-1" : "1") + ",'([^']*)','(#[0-9a-fA-F]{6})'\\)");
}
function rangeFor(def: PropDef, file: string): Range {
  const r = def.rangeByFile && def.rangeByFile[file];
  if (r) return r;
  return { min: def.min ?? 0, max: def.max ?? 0, step: def.step ?? 0.05 };
}
/** Urutan momen cerita per template (untuk validasi: tiap momen harus
 *  sesudah momen sebelumnya). */
export const BEAT_ORDER: Record<string, string[]> = {
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
// @ts-only-begin
/** Objek yang bisa dipilih di tab Objek: nama awam + ikon + warna +
 *  satu kalimat tentang objek itu. */
export const OBJECTS: Record<string, { name: string; icon: string; color: string; desc: string }> = {
  claude: { name: "Maskot oranye", icon: "🟠", color: "#d97757", desc: "Tokoh utama yang oranye — geser, besarkan, atau ubah warnanya." },
  codex: { name: "Maskot biru", icon: "🔵", color: "#7b8cff", desc: "Tokoh kedua yang biru — geser, besarkan, atau ubah warnanya." },
  gemini: { name: "Maskot ungu", icon: "🟣", color: "#b794f6", desc: "Tokoh ketiga yang ungu, hanya ada di video Trio." },
  eyes: { name: "Mata", icon: "👁️", color: "#8a877e", desc: "Mata semua maskot — miring ke atas seperti senang, ke bawah seperti marah." },
  board: { name: "Papan skor", icon: "📋", color: "#f2c14e", desc: "Papan di dinding yang menunjukkan angka selama cerita." },
  monitor: { name: "Layar kecil", icon: "🖥️", color: "#5b8dff", desc: "Layar kecil di belakang tiap maskot." },
  screen: { name: "Layar besar", icon: "📺", color: "#3ddc84", desc: "Layar besar tempat kode, perintah, atau obrolan tampil." },
  tank: { name: "Tangki kuota", icon: "🛢️", color: "#ffc857", desc: "Tangki di tengah panggung yang menunjukkan sisa kuota." },
  keyboard: { name: "Keyboard", icon: "⌨️", color: "#9aa0aa", desc: "Keyboard di atas meja yang dipakai kedua maskot." },
  fort: { name: "Benteng", icon: "🏰", color: "#d97757", desc: "Benteng kardus di kedua sisi, lengkap dengan benderanya." },
  catapult: { name: "Katapel", icon: "🎯", color: "#f2c14e", desc: "Katapel yang menembakkan koin ke benteng lawan." },
  troops: { name: "Pasukan kecil", icon: "🧑‍🤝‍🧑", color: "#f19cb0", desc: "Pasukan kecil yang muncul dari portal selama perang." },
  war: { name: "Tombol & tagihan", icon: "⚔️", color: "#3c64e1", desc: "Tombol biru yang diperebutkan dan tagihan yang terus naik." },
  boss: { name: "Bos", icon: "👔", color: "#e3b98f", desc: "Bos di ruangannya sendiri — muncul saat kamera menyorotnya." },
  mug: { name: "Cangkir", icon: "☕", color: "#b08968", desc: "Cangkir kopi di atas meja." },
  window: { name: "Jendela", icon: "🪟", color: "#7fd0ff", desc: "Jendela di dinding." },
  lamp: { name: "Lampu", icon: "💡", color: "#ffe08a", desc: "Lampu di atas meja." },
  typing: { name: "Tulisan yang diketik", icon: "✍️", color: "#9be9a8", desc: "Tulisan yang diketik maskot di layar, beserta waktunya." },
  story: { name: "Jalan cerita", icon: "⏱️", color: "#b794f6", desc: "Kapan tiap momen penting dalam cerita terjadi." },
  notes: { name: "Catatan tempel", icon: "📝", color: "#ffe08a", desc: "Catatan tempel yang beterbangan di dinding." },
  bomb: { name: "Bom", icon: "💣", color: "#ff5a4a", desc: "Bom dengan hitung mundur di layar." },
};
// @ts-only-end

/** Baca satu nilai prop dari HTML (null bila anchor tidak ketemu).
 *  Konstanta sisipan (J1) yang belum ada dibaca sebagai nilai awalnya —
 *  itu perilaku aslinya, jadi tampilan awal sama dengan template asli. */
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
    const span = findArraySpan(html, a.name);
    if (!span) return null;
    const v = parseJsArray(html.slice(span.start, span.end));
    return Array.isArray(v) ? (v as PropValue) : null;
  }
  if (a.t === "assign") {
    return findConstNum(html, a.name);
  }
  if (a.t === "mkmon") {
    const re = /mkMon\((-?[\d.]+),\(g/g;
    const found: number[] = [];
    let m: RegExpExecArray | null;
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
    const out: string[] = [];
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
    const out: unknown[] = [];
    for (const name of a.names) {
      const span = findArraySpan(html, name);
      if (!span) return null;
      const v = parseJsArray(html.slice(span.start, span.end));
      if (!Array.isArray(v)) return null;
      out.push(v);
    }
    return out as PropValue;
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
    return Array.isArray(v) ? (v as PropValue) : null;
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
    const found: NumSpan[] = [];
    let m: RegExpExecArray | null;
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
      const baseArr: number[] = cur ? [...cur] : (Array.isArray(a.default) ? [...(a.default as number[])] : [a.default as number]);
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
    const inner = (value as string[]).map(jsSingle).join(",");
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
    return { html: html.slice(0, span.start) + chatToJs(value as unknown[]) + html.slice(span.end), ok: true };
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
  // Sinkron garis tepi balon kata: warna maskot oranye -> garis tepi balon
  // di template satu maskot (typing/deploy/bughunter/bomb/meeting; sleep
  // tidak punya balon kata, jadi tidak ada yang berubah di sana).
  if ("claude.color" in props && typeof props["claude.color"] === "string") {
    const col = (props["claude.color"] as string).slice(1).toLowerCase();
    h = h.replace(
      /border:max\(1px,calc\(var\(--u\)\*\.2\)\) solid #[0-9a-fA-F]{6}/g,
      `border:max(1px,calc(var(--u)*.2)) solid #${col}`
    );
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
/** Validasi props: jarak antar maskot, bingkai, rentang tiap pengaturan
 *  (per template bila berbeda), urutan momen cerita, dan aturan jaga
 *  antar pengaturan (papan, benteng/katapel, cangkir, goyangan).
 *  Pesan diawali id pengaturan supaya UI bisa menaruhnya di baris yang
 *  benar; tampilannya dibersihkan dari id itu di Studio. */
export function validateProps(propsIn: PropsInput, file: string, len = 0): Validation {
  const props = normalizeProps(propsIn);
  const errors: string[] = [];
  const warnings: string[] = [];
  const xs: XPos[] = [];
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
  const pairs: [string, string][] = [["monitor.claude.x", "claude.x"], ["monitor.codex.x", "codex.x"], ["monitor.gemini.x", "gemini.x"]];
  for (const [mon, mas] of pairs) {
    const a = props[mon];
    const b = props[mas];
    if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) > 0.8)
      warnings.push(`${mon}: layarnya jauh dari maskotnya — layar dan maskot jadi tidak sejajar.`);
  }
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
document.addEventListener('click',function(e){try{var r=document.documentElement.getBoundingClientRect();parent.postMessage({__stClick:{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}},'*')}catch(err){}},true);
})();
}catch(e){window.__stErr=String(e)}<\/script>`;
