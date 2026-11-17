#!/usr/bin/env node
// Probe: apakah #template-perang bisa dibuka headless (pasca-crash A6)?
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
page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const t0 = Date.now();
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
console.log("label Comp 1:", await page.evaluate(() => (document.body.textContent.match(/Comp 1 · [^\n]*/)||["?"])[0]));
try {
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 120000 });
  console.log("Preview siap sesudah", Date.now() - t0, "mdtk");
} catch (e) {
  console.log("TIMEOUT Preview siap;", "body:", (await page.evaluate(() => document.body.innerText)).slice(0, 500));
}
console.log("errors:", errs.length ? errs : "(tidak ada)");
await page.waitForTimeout(3000);
console.log("bridge ok:", await page.evaluate(() => { try { const w = document.querySelector("#pv").contentWindow; return !!w.__st && w.__st.ok(); } catch (e) { return String(e); } }));
await browser.close();
