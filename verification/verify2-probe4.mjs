#!/usr/bin/env node
// Probe4: caption Kuota di studio — caps() sebelum edit, nilai input,
// caps() polling sesudah Terapkan, dan apakah teks baru ada di srcdoc.
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
await page.goto("http://localhost:3000/#template-kuota", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(3000);
const capsBefore = await page.evaluate(() => {
  try { const c = document.querySelector("#pv")?.contentWindow?.__st?.caps?.(); return c ? [c.length, c[0]] : "caps()=" + JSON.stringify(c); }
  catch (e) { return "ERR " + String(e).slice(0, 120); }
});
console.log("caps() SEBELUM edit:", JSON.stringify(capsBefore));
await page.click(".tour-skip").catch(() => {});
await page.click('button[role="tab"]:has-text("Caption")');
await page.waitForTimeout(400);
const nCap = await page.locator(".edit-cap .cap-text").count();
const firstVal = await page.locator(".edit-cap .cap-text >> nth=0").inputValue().catch(() => "?");
console.log(`jumlah input .cap-text=${nCap}; nilai pertama=${JSON.stringify(firstVal)}`);
await page.fill(".edit-cap .cap-text >> nth=0", "EDIT UI KUOTA");
console.log("nilai sesudah fill:", JSON.stringify(await page.locator(".edit-cap .cap-text >> nth=0").inputValue()));
const applyDisabled = await page.locator("#apply-cap").isDisabled().catch(() => "?");
console.log("tombol #apply-cap disabled?", applyDisabled);
await page.click("#apply-cap");
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    try {
      const w = document.querySelector("#pv")?.contentWindow;
      const c = w?.__st?.caps?.();
      const sd = document.querySelector("#pv")?.srcdoc || "";
      return { ready: document.body.textContent?.includes("Preview siap"), caps0: c ? c[0]?.[2] : null, capsLen: c ? c.length : null, stOk: !!w?.__st && w.__st.ok(), sdHas: sd.includes("EDIT UI KUOTA") };
    } catch (e) { return { err: String(e).slice(0, 100) }; }
  });
  console.log(`t+${(i + 1) * 2}s:`, JSON.stringify(r));
  if (r.caps0 === "EDIT UI KUOTA") break;
}
console.log("errs:", JSON.stringify(errs));
await browser.close();
