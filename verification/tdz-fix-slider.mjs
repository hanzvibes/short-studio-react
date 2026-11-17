#!/usr/bin/env node
// Uji pratinjau langsung slider array: di template-code, geser skor
// Performa (board.claude.final[2]) 88 -> 50. SEBELUM Terapkan, srcdoc
// preview harus sudah memuat [96,94,50] (dulu: srcdoc tak berubah).
// Lalu Terapkan tetap jalan dan nilai bertahan.
//   node verification/tdz-fix-slider.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
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
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
await page.click(".tour-skip").catch(() => {});
// Buka tab Objek.
await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
  await page.locator("button", { hasText: "Objek" }).first().click();
});
await page.waitForTimeout(800);
// Pilih objek Papan skor.
await page.locator("button.obj-pick-item", { hasText: "Papan skor" }).click();
await page.waitForTimeout(800);
const slider = page.locator('input[type="range"][aria-label="Angka akhir oranye — Performa"]');
await slider.waitFor({ timeout: 15000 });
const before = await page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
console.log("srcdoc awal memuat [96,94,88]:", before.includes("[96,94,88]"));
console.log("nilai slider awal:", await slider.inputValue());
// Geser 88 -> 50 (event input/change seperti drag asli).
await slider.evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, "50");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(600); // lewati debounce 250 mdtk + remount
console.log("nilai tampil sesudah geser:", await slider.inputValue());
await page.waitForTimeout(2500); // beri waktu three.js load ulang di iframe
const mid = await page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
const liveOk = mid.includes("[96,94,50]");
console.log("SEBELUM Terapkan, srcdoc memuat [96,94,50]:", liveOk);
const readyMid = await page.evaluate(() => document.body.textContent?.includes("Preview siap"));
console.log("status sesudah pratinjau langsung:", readyMid ? "Preview siap" : "BELUM siap");
// Terapkan tetap jalan.
await page.locator("#apply-objek").click();
await page.waitForTimeout(2500);
const after = await page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
console.log("SESUDAH Terapkan, srcdoc memuat [96,94,50]:", after.includes("[96,94,50]"));
console.log("console/page errors:", errs.length ? errs : "tidak ada");
await browser.close();
const ok = liveOk && after.includes("[96,94,50]") && errs.length === 0;
console.log(ok ? "SLIDER ARRAY LIVE-PREVIEW OK" : "SLIDER ARRAY GAGAL");
process.exit(ok ? 0 : 1);
