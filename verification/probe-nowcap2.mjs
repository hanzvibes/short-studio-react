#!/usr/bin/env node
// Retest D1b-1 (lanjutan): tunggu bridge BENAR-BENAR baru, lalu baca .now-cap + gT().
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) => r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => { const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", ""); return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) }); });
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(3500);
await page.click(".tour-skip").catch(() => {});
const bridge = (fn, ...args) => page.evaluate(([s, ...a]) => { try { const w = document.querySelector("#pv").contentWindow; return eval(`(${s})`)(w, ...a); } catch (e) { return "ERR:" + String(e).slice(0, 120); } }, [fn.toString(), ...args]);
await page.locator('[role="tab"]', { hasText: /^Caption/ }).first().click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Teks caption 1"]').fill("Verifikasi caption 23:26");
const t0 = Date.now();
await page.locator("#apply-cap").click();
// Poll sampai bridge menampilkan caption baru (remount selesai).
let caps0 = "";
for (let k = 0; k < 60; k++) {
  await page.waitForTimeout(500);
  caps0 = await bridge((w) => w.__st ? w.__st.caps()[0][2] : "belum-ada");
  if (caps0 === "Verifikasi caption 23:26") break;
}
console.log(`bridge caps[0] baru sesudah ${Date.now() - t0} mdtk:`, caps0);
console.log("gT() saat itu:", await bridge((w) => w.__st ? w.__st.gT() : "belum-ada"));
console.log("stage class:", await page.evaluate(() => document.querySelector("#stage")?.className));
console.log("statusbar:", (await page.textContent(".statusbar"))?.trim().slice(0, 120));
// Sekarang seek ke 4 dan tunggu sinkronisasi React.
await bridge((w) => { w.__st.pause(); w.__st.seek(4); return true; });
for (let k = 0; k < 10; k++) {
  await page.waitForTimeout(500);
  const nc = (await page.textContent(".now-cap"))?.trim();
  console.log(`t+${(k + 1) * 0.5}s now-cap:`, nc?.slice(0, 80), "| gT():", await bridge((w) => w.__st.gT()));
  if (nc?.includes("Verifikasi caption")) break;
}
await browser.close();
