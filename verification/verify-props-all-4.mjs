#!/usr/bin/env node
// Verifikasi INDEPENDEN bagian 4: D1b-perbaikan (caption terlihat via .now-cap + diff piksel),
// D3-perbaikan via 2 jalur (drawer + Simpan, tab Teks + Simpan sebagai video baru).
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
const OUT = "/home/hatch/workspace/short-studio-react/verification";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
await mkdir(OUT, { recursive: true });
const results = [];
const errors = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra: String(extra).slice(0, 400) }); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 200) : ""}`); };
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
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) => r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => { const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", ""); return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) }); });
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
async function openTemplate(hash, label) {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`http://localhost:3000/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  if (label) await page.waitForFunction((l) => document.body.textContent?.includes(`Comp 1 · ${l}`), label, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(300);
}
async function stEval(fn, ...args) {
  return page.evaluate(([fnStr, ...a]) => { const pv = document.querySelector("#pv"); const w = pv?.contentWindow; const f = eval(`(${fnStr})`); return f(w, ...a); }, [fn.toString(), ...args]);
}
const pauseSeek = (t) => stEval((w, tt) => { try { w.__st.pause(); w.__st.seek(tt); return true; } catch (e) { return String(e); } }, t);
async function clickTab(name) { await page.locator('[role="tab"]', { hasText: new RegExp(`^${name}`) }).first().click(); await page.waitForTimeout(400); }

console.log("\n== D1b-perbaikan: caption terlihat di preview ==");
await openTemplate("#template-code", "Adu Kode");
await pauseSeek(4); await page.waitForTimeout(600);
const capBeforeShot = await page.locator("#stage").screenshot({ path: `${OUT}/props-all-caption-before.png` });
const nowCapBefore = await page.textContent(".now-cap");
await clickTab("Caption");
const CAP_BARU = "Verifikasi caption 23:26";
await page.locator('input[aria-label="Teks caption 1"]').fill(CAP_BARU);
await page.locator("#apply-cap").click();
await page.waitForTimeout(1200);
await pauseSeek(4); await page.waitForTimeout(600);
const nowCapAfter = await page.textContent(".now-cap");
ok("D1b-1 bilah caption studio menampilkan teks baru (t=4)", String(nowCapAfter).includes("Verifikasi caption"), "sebelum: " + String(nowCapBefore).trim().slice(0, 60) + " | sesudah: " + String(nowCapAfter).trim().slice(0, 60));
const capAfterShot = await page.locator("#stage").screenshot({ path: `${OUT}/props-all-caption-after.png` });
const dCap = pixelDiff(capBeforeShot, capAfterShot);
ok("D1b-2 preview BERUBAH sesudah edit caption (piksel, t=4)", dCap.changed > 50, `${dCap.changed} px (${dCap.pct}%)`);

console.log("\n== D3-perbaikan jalur 1: drawer → + Simpan ==");
await page.locator("#menu").click(); await page.waitForTimeout(600);
await page.locator("button:has-text('+ Simpan')").first().click();
await page.waitForTimeout(400);
const dlg1 = await page.evaluate(() => !!document.querySelector("#mineH"));
ok("D3a-1 dialog Simpan terbuka via drawer", dlg1, "");
if (dlg1) {
  await page.locator(".dlg input").first().fill("Verifikasi Props-All");
  await page.locator(".dlg button:has-text('Simpan video')").click();
  await page.waitForTimeout(800);
  const n1 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("ss.mine.v1") || "[]").length; } catch { return -1; } });
  ok("D3b-1 entri tersimpan (jalur drawer)", n1 >= 1, "jumlah: " + n1);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click(".tour-skip").catch(() => {});
  const vis1 = await page.evaluate(() => document.body.textContent?.includes("Verifikasi Props-All"));
  ok("D3c-1 sesudah reload entri tampil di galeri (jalur drawer)", vis1 === true, "");
  await page.screenshot({ path: `${OUT}/props-all-mine-after-reload.png`, fullPage: false });
}

console.log("\n== D3-perbaikan jalur 2: tab Teks → Simpan sebagai video baru ==");
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.click(".tour-skip").catch(() => {});
await clickTab("Teks");
await page.locator("button:has-text('Simpan sebagai video baru')").click();
await page.waitForTimeout(400);
const dlg2 = await page.evaluate(() => !!document.querySelector("#mineH"));
ok("D3a-2 dialog Simpan terbuka via tab Teks", dlg2, "");
if (dlg2) {
  await page.locator(".dlg input").first().fill("Verifikasi Jalur Teks");
  await page.locator(".dlg button:has-text('Simpan video')").click();
  await page.waitForTimeout(800);
  const n2 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("ss.mine.v1") || "[]").length; } catch { return -1; } });
  ok("D3b-2 entri tersimpan (jalur tab Teks)", n2 >= 1, "jumlah: " + n2);
}
console.log("\n== console/page errors (bagian 4): " + errors.length + " ==");
errors.slice(0, 10).forEach((e) => console.log("  ERR: " + e));
ok("E1b nol console/page error (bagian 4)", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "");
await writeFile(`${OUT}/props-all-verify-headless-4.json`, JSON.stringify({ results, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `\nGAGAL: ${bad.length} dari ${results.length}` : `\nSEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
