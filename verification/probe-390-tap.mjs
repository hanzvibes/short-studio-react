#!/usr/bin/env node
// Probe C3b: kenapa ketuk kanan 390px tidak memilih Maskot biru?
// + ulang diff piksel A6f/A7h dengan page.screenshot().
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra: String(extra).slice(0, 300) }); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 200) : ""}`); };
function decodePNG(buf) {
  let pos = 8; let w = 0, h = 0, bitDepth = 0, colorType = 0; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; } if (type === "IDAT") idat.push(data); pos += 12 + len; }
  const ch = colorType === 6 ? 4 : 3; const raw = inflateSync(Buffer.concat(idat)); const stride = w * ch; const out = new Uint8Array(w * h * 4); let p = 0;
  const paeth = (a, b, c) => { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) { const f = raw[p++]; const row = raw.subarray(p, p + stride); p += stride; const prev = y === 0 ? null : out.subarray((y - 1) * w * 4, y * w * 4);
    for (let x = 0; x < stride; x++) { let v = row[x]; const a = x >= ch ? out[y * w * 4 + x - ch] : 0; const b = prev ? prev[x] : 0; const c = x >= ch && prev ? prev[x - ch] : 0;
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255; else if (f === 3) v = (v + ((a + b) >> 1)) & 255; else if (f === 4) v = (v + paeth(a, b, c)) & 255;
      const px = (y * w + Math.floor(x / ch)) * 4 + (x % ch); out[px] = v; }
    for (let x = 0; x < w; x++) if (ch === 3) out[(y * w + x) * 4 + 3] = 255; }
  return { w, h, data: out };
}
function pixelDiff(a, b) {
  const A = decodePNG(a), B = decodePNG(b);
  if (A.w !== B.w || A.h !== B.h) return { changed: -1, pct: -1 };
  let changed = 0; for (let i = 0; i < A.w * A.h; i++) { const d = Math.max(Math.abs(A.data[i*4]-B.data[i*4]), Math.abs(A.data[i*4+1]-B.data[i*4+1]), Math.abs(A.data[i*4+2]-B.data[i*4+2])); if (d > 10) changed++; }
  return { changed, pct: +(100 * changed / (A.w * A.h)).toFixed(2) };
}
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
async function routeVendor(p) {
  await p.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) => r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await p.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => { const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", ""); return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) }); });
  await p.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
  await p.route("https://fonts.gstatic.com/**", (r) => r.abort());
}
await routeVendor(page);
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.goto("http://localhost:3000/#template", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(3500);
await page.click(".tour-skip").catch(() => {});
await page.locator('[role="tab"]', { hasText: /^Objek/ }).first().click();
await page.waitForTimeout(500);
const geo = await page.evaluate(() => {
  const st = document.querySelector("#stage").getBoundingClientRect();
  const tap = document.querySelector(".tap").getBoundingClientRect();
  const cs = getComputedStyle(document.querySelector(".tap"));
  return {
    scrollY: window.scrollY, innerH: window.innerHeight, docH: document.documentElement.scrollHeight,
    stage: { x: st.x, y: st.y, w: st.width, h: st.height },
    tap: { x: tap.x, y: tap.y, w: tap.width, h: tap.height, display: cs.display },
    themeBtnVisible: (() => { const b = document.querySelector("#themeBtn"); const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
  };
});
console.log("GEO:", JSON.stringify(geo, null, 1));
const pt = (fx, fy) => ({ x: geo.stage.x + geo.stage.w * fx, y: geo.stage.y + geo.stage.h * fy });
for (const [fx, fy, label] of [[0.25, 0.6, "kiri"], [0.75, 0.6, "kanan"]]) {
  const p = pt(fx, fy);
  const el = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${String(e.className).slice(0, 60)}` : "(tidak ada)"; }, [p.x, p.y]);
  console.log(`elementFromPoint ${label} (${Math.round(p.x)},${Math.round(p.y)}):`, el);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(500);
  console.log(`sesudah ketuk ${label}:`, ((await page.textContent(".obj-now")) || "").trim().slice(0, 60));
}
// Coba lagi sesudah scroll stage ke tengah viewport
await page.evaluate(() => document.querySelector("#stage").scrollIntoView({ block: "center" }));
await page.waitForTimeout(500);
const geo2 = await page.evaluate(() => { const st = document.querySelector("#stage").getBoundingClientRect(); return { x: st.x, y: st.y, w: st.width, h: st.height, scrollY: window.scrollY }; });
console.log("GEO sesudah scrollIntoView:", JSON.stringify(geo2));
const p2 = { x: geo2.x + geo2.w * 0.75, y: geo2.y + geo2.h * 0.6 };
const el2 = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${String(e.className).slice(0, 60)}` : "(tidak ada)"; }, [p2.x, p2.y]);
console.log(`elementFromPoint kanan sesudah scroll (${Math.round(p2.x)},${Math.round(p2.y)}):`, el2);
await page.mouse.click(p2.x, p2.y);
await page.waitForTimeout(500);
const h2 = ((await page.textContent(".obj-now")) || "").trim().slice(0, 60);
console.log("sesudah ketuk kanan + scrollIntoView:", h2);
ok("P1 ketuk kanan 390 memilih Maskot biru bila stage terlihat penuh", h2.includes("Maskot biru"), h2);
// Tema via keyboard D (tombol disembunyikan CSS <=900px)
const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
await page.keyboard.press("d");
await page.waitForTimeout(400);
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
ok("P2 tema 390 bisa diganti via tombol D (themeBtn display:none by design)", themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/props-all-390-theme-keyboard.png" });

// ---- A6f/A7h ulang: page.screenshot() penuh ----
async function renderDirect(url, t, name) {
  const p2 = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs2 = [];
  p2.on("pageerror", (e) => errs2.push(String(e).slice(0, 200)));
  await routeVendor(p2);
  await p2.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p2.waitForTimeout(4000);
  const info = await p2.evaluate((tt) => {
    const go = document.getElementById("go"), gui = document.getElementById("gui");
    if (go) go.style.display = "none"; if (gui) gui.style.display = "none";
    try { window.renderAt(tt); return { ok: true }; } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
  }, t);
  await p2.waitForTimeout(600);
  const buf = await p2.screenshot({ path: `/home/hatch/workspace/short-studio-react/verification/props-all-${name}.png` });
  const canvas = await p2.evaluate(() => { const c = document.querySelector("canvas"); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p2.close();
  return { info, errs2, buf, canvas };
}
const oP = await renderDirect("http://localhost:8321/orig-perang.html", 15, "direct2-perang-orig-t15");
console.log("canvas orig-perang:", JSON.stringify(oP.canvas), "errs:", oP.errs2);
const fP = await renderDirect("http://localhost:8321/perang-fort.html", 15, "direct2-perang-fort13-t15");
console.log("canvas perang-fort:", JSON.stringify(fP.canvas), "errs:", fP.errs2);
const dF = pixelDiff(oP.buf, fP.buf);
ok("P3 benteng 1.3 vs asli BERUBAH (piksel, t=15, page shot)", dF.changed > 50, `${dF.changed} px (${dF.pct}%)`);
const oK = await renderDirect("http://localhost:8321/orig-kuota.html", 6, "direct2-kuota-orig-t6");
const tK = await renderDirect("http://localhost:8321/kuota-tank30.html", 6, "direct2-kuota-tank30-t6");
const dT = pixelDiff(oK.buf, tK.buf);
ok("P4 tangki 30 vs 92 BERUBAH (piksel, t=6, page shot)", dT.changed > 50, `${dT.changed} px (${dT.pct}%)`);
console.log("errors halaman studio:", errs.length ? errs : "(tidak ada)");
await writeFile("/home/hatch/workspace/short-studio-react/verification/props-all-probe-390.json", JSON.stringify({ results, geo, geo2 }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `GAGAL: ${bad.length} dari ${results.length}` : `SEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
