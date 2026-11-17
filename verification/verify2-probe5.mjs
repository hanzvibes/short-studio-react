#!/usr/bin/env node
// Probe5: ulangi persis alur probe3 (selektor Terapkan first-match, baca
// di +1.5 dtk) lalu polling 20 dtk — apakah caps() muncul terlambat?
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 160)));
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("http://localhost:3000/#template-kuota", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(5000);
await page.click(".tour-skip").catch(() => {});
await page.click('button[role="tab"]:has-text("Caption")');
await page.waitForTimeout(400);
await page.fill(".edit-cap .cap-text >> nth=0", "EDIT UI KUOTA");
const clicked = await page.evaluate(() => {
  const b = document.querySelector('button.btn.primary');
  return b ? (b.id || b.textContent?.trim()) : null;
});
console.log("tombol .btn.primary pertama di DOM:", JSON.stringify(clicked));
await page.click('button.btn.primary:has-text("Terapkan semua edit")');
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log("caps()[0] di +1.5 dtk:", JSON.stringify(await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.caps()?.[0]?.[2] ?? null)));
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(2000);
  const v = await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.caps()?.[0]?.[2] ?? null);
  console.log(`caps()[0] di +${3.5 + i * 2} dtk:`, JSON.stringify(v));
  if (v === "EDIT UI KUOTA") break;
}
await browser.close();
