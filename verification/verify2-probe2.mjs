#!/usr/bin/env node
// Probe2: apakah goto hash-only code -> perang benar-benar ganti template?
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const waitReady = () => page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await waitReady();
await page.click(".tour-skip").catch(() => {});
console.log("DI CODE: hash=", await page.evaluate(() => location.hash), "| template-label=", JSON.stringify(await page.evaluate(() => document.body.textContent?.match(/Template: [^\n—]*/)?.[0] ?? document.querySelector(".hint")?.textContent ?? null)));
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);
console.log("SETELAH GOTO PERANG: hash=", await page.evaluate(() => location.hash));
console.log("Preview siap masih ada?", await page.evaluate(() => document.body.textContent?.includes("Preview siap")));
await page.waitForTimeout(3000);
console.log("Preview siap sesudah 3 dtk?", await page.evaluate(() => document.body.textContent?.includes("Preview siap")));
// Buka Objek dan lihat daftar objek
await page.getByRole("button", { name: "Objek" }).click().catch(async () => { await page.locator("button", { hasText: "Objek" }).first().click(); });
await page.waitForTimeout(1000);
console.log("PICK-ITEMS:", JSON.stringify(await page.locator("button.obj-pick-item").allTextContents()));
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click();
await page.waitForTimeout(1000);
console.log("RANGE-ARIA:", JSON.stringify(await page.locator('input[type="range"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))));
await browser.close();
