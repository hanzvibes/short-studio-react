#!/usr/bin/env node
// Probe: panel Objek Perang — objek apa aktif, slider apa tersedia.
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
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR", m.text().slice(0, 200)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
await page.click(".tour-skip").catch(() => {});
// Tab mana yang aktif? Daftar semua tab.
console.log("TABS:", JSON.stringify(await page.locator('button[role="tab"]').allTextContents()));
await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
  await page.locator("button", { hasText: "Objek" }).first().click();
});
await page.waitForTimeout(1000);
console.log("PICK-ITEMS:", JSON.stringify(await page.locator("button.obj-pick-item").allTextContents()));
console.log("RANGE-ARIA-SEBELUM-PILIH:", JSON.stringify(await page.locator('input[type="range"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))));
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click();
await page.waitForTimeout(1000);
const header = await page.evaluate(() => document.body.textContent?.match(/Sedang mengedit: [^\n]*/)?.[0] ?? null);
console.log("HEADER sesudah klik Jalan cerita:", JSON.stringify(header));
console.log("RANGE-ARIA-SESUDAH:", JSON.stringify(await page.locator('input[type="range"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))));
console.log("ARIA-PRESSED Jalan cerita:", await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().getAttribute("aria-pressed"));
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-probe-perang-objek.png" });
await browser.close();
