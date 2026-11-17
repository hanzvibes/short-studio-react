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

export type Shot = [number, number[] | string, ...unknown[]];
export type Cap = [number, number, string, number];

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
