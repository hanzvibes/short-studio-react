#!/usr/bin/env node
// Verifikasi ulang #2 — pratinjau langsung slider array:
// A) Adu Kode skor Performa 88 -> 50; B) Kuota kurva tangki baris 3: 92 -> 30.
// Bukti: srcdoc SUDAH berubah SEBELUM Terapkan + diff piksel preview.
//   node verification/verify2-slider.mjs
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

// Decoder PNG minimal (RGBA8 non-interlaced) -> {w,h,data}
function decodePng(buf) {
  let pos = 8; const idat = []; let w = 0, h = 0, bitDepth = 0, colorType = 0;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`PNG tak didukung bitDepth=${bitDepth} colorType=${colorType}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp; const out = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0; const b = prev[x]; const c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      cur[x] = v;
    }
    for (let px = 0; px < w; px++) { out[(y * w + px) * 4] = cur[px * bpp]; out[(y * w + px) * 4 + 1] = cur[px * bpp + 1]; out[(y * w + px) * 4 + 2] = cur[px * bpp + 2]; out[(y * w + px) * 4 + 3] = 255; }
    prev = cur;
  }
  return { w, h, data: out };
}
function pxDiff(a, b) {
  const A = decodePng(a), B = decodePng(b);
  if (A.w !== B.w || A.h !== B.h) return { diff: -1, pct: -1, note: `ukuran beda ${A.w}x${A.h} vs ${B.w}x${B.h}` };
  let diff = 0; const n = A.w * A.h;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (Math.abs(A.data[o] - B.data[o]) > 10 || Math.abs(A.data[o + 1] - B.data[o + 1]) > 10 || Math.abs(A.data[o + 2] - B.data[o + 2]) > 10) diff++;
  }
  return { diff, pct: +(100 * diff / n).toFixed(2), note: `${A.w}x${A.h}` };
}

const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const OUT = "/home/hatch/workspace/short-studio-react/verification";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
  });
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  return { ctx, page, errs };
}
async function openTemplate(page, hash) {
  await page.goto(`http://localhost:3000/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
  await page.click(".tour-skip").catch(() => {});
  await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
    await page.locator("button", { hasText: "Objek" }).first().click();
  });
  await page.waitForTimeout(800);
}
async function shotPv(page, name) {
  const el = page.locator("#pv");
  await el.waitFor({ timeout: 15000 });
  const buf = await el.screenshot({ path: `${OUT}/${name}.png` });
  return buf;
}
async function setSlider(page, label, value) {
  const slider = page.locator(`input[type="range"][aria-label="${label}"]`);
  await slider.waitFor({ timeout: 15000 });
  const before = await slider.inputValue();
  await slider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  return before;
}
const srcdoc = (page) => page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");

// ---------- A) Skor Adu Kode ----------
{
  const { ctx, page, errs } = await newPage();
  await openTemplate(page, "#template-code");
  await page.locator("button.obj-pick-item", { hasText: "Papan skor" }).click();
  await page.waitForTimeout(800);
  const sd0 = await srcdoc(page);
  console.log(`A skor awal: srcdoc memuat [96,94,88]=${sd0.includes("[96,94,88]")}`);
  // Arahkan preview ke t=25 agar angka papan terlihat, lalu screenshot awal.
  await page.evaluate(() => { try { document.querySelector("#pv").contentWindow.__st.seek(25); } catch {} });
  await page.waitForTimeout(1500);
  const before = await shotPv(page, "verify2-skor-before");
  const v0 = await setSlider(page, "Angka akhir oranye — Performa", 50);
  console.log(`A slider awal=${v0} -> 50; nilai tampil=${await page.locator('input[type="range"][aria-label="Angka akhir oranye — Performa"]').inputValue()}`);
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  const sd1 = await srcdoc(page);
  const liveOk = sd1.includes("[96,94,50]");
  console.log(`A SEBELUM Terapkan: srcdoc memuat [96,94,50]=${liveOk}; status Preview siap=${await page.evaluate(() => document.body.textContent?.includes("Preview siap"))}`);
  await page.evaluate(() => { try { document.querySelector("#pv").contentWindow.__st.seek(25); } catch {} });
  await page.waitForTimeout(1500);
  const after = await shotPv(page, "verify2-skor-after");
  const d = pxDiff(before, after);
  console.log(`A diff piksel preview sesudah geser (SEBELUM Terapkan): ${d.diff} px (${d.pct}%) ${d.note}`);
  // Terapkan tetap jalan + nilai bertahan.
  await page.locator("#apply-objek").click();
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
  await page.waitForTimeout(1500);
  const sd2 = await srcdoc(page);
  console.log(`A sesudah Terapkan: srcdoc memuat [96,94,50]=${sd2.includes("[96,94,50]")}; console/page errors=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
  await ctx.close();
}
// ---------- B) Kurva tangki Kuota ----------
{
  const { ctx, page, errs } = await newPage();
  await openTemplate(page, "#template-kuota");
  const items = await page.locator("button.obj-pick-item").allTextContents();
  console.log(`B objek Kuota: ${items.join(" | ")}`);
  await page.locator("button.obj-pick-item", { hasText: "Tangki" }).first().click();
  await page.waitForTimeout(800);
  const sd0 = await srcdoc(page);
  console.log(`B kurva awal: srcdoc memuat [5,92]=${sd0.includes("[5,92]")}`);
  await page.evaluate(() => { try { document.querySelector("#pv").contentWindow.__st.seek(6); } catch {} });
  await page.waitForTimeout(1500);
  const before = await shotPv(page, "verify2-tank-before");
  const v0 = await setSlider(page, "Baris 3 sisa kuota", 30);
  console.log(`B slider awal=${v0} -> 30; nilai tampil=${await page.locator('input[type="range"][aria-label="Baris 3 sisa kuota"]').inputValue()}`);
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  const sd1 = await srcdoc(page);
  const liveOk = sd1.includes("[5,30]");
  console.log(`B SEBELUM Terapkan: srcdoc memuat [5,30]=${liveOk}; status Preview siap=${await page.evaluate(() => document.body.textContent?.includes("Preview siap"))}`);
  await page.evaluate(() => { try { document.querySelector("#pv").contentWindow.__st.seek(6); } catch {} });
  await page.waitForTimeout(1500);
  const after = await shotPv(page, "verify2-tank-after");
  const d = pxDiff(before, after);
  console.log(`B diff piksel preview sesudah geser (SEBELUM Terapkan): ${d.diff} px (${d.pct}%) ${d.note}`);
  await page.locator("#apply-objek").click();
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
  await page.waitForTimeout(1500);
  const sd2 = await srcdoc(page);
  console.log(`B sesudah Terapkan: srcdoc memuat [5,30]=${sd2.includes("[5,30]")}; console/page errors=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
console.log("SLIDER SELESAI");
