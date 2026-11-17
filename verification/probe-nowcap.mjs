#!/usr/bin/env node
// Retest D1b-1: apakah .now-cap memang basi sesudah Terapkan caption,
// atau bacaan sebelumnya terlalu dini (remount belum selesai)?
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
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
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
const stEval = (fn, ...args) => page.evaluate(([s, ...a]) => { const w = document.querySelector("#pv").contentWindow; return eval(`(${s})`)(w, ...a); }, [fn.toString(), ...args]);
const nowCap = () => page.textContent(".now-cap");
const bridgeCaps0 = () => stEval((w) => { try { return w.__st.caps()[0][2]; } catch (e) { return "ERR:" + String(e).slice(0, 100); } });
console.log("awal: bridge caps[0] =", await bridgeCaps0(), "| now-cap =", (await nowCap()).trim().slice(0, 70));
await page.locator('[role="tab"]', { hasText: /^Caption/ }).first().click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Teks caption 1"]').fill("Verifikasi caption 23:26");
await page.locator("#apply-cap").click();
// TUNGGU remount selesai dengan benar: status kembali "Preview siap" + bridge baru.
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(1500);
console.log("sesudah Terapkan + tunggu siap: bridge caps[0] =", await bridgeCaps0());
await stEval((w) => { w.__st.pause(); w.__st.seek(4); });
await page.waitForTimeout(1500);
console.log("sesudah seek(4): bridge caps[0] =", await bridgeCaps0(), "| now-cap =", (await nowCap()).trim().slice(0, 70));
// baca ulang sesudah 3 detik lagi (polling rAF)
await page.waitForTimeout(3000);
console.log("sesudah +3 dtk: now-cap =", (await nowCap()).trim().slice(0, 70));
console.log("errors:", errs.length ? errs : "(tidak ada)");
await browser.close();
