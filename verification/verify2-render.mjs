#!/usr/bin/env node
// Verifikasi ulang #2 — render langsung file hasil CLI (+ kontrol asli).
//   node verification/verify2-render.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const CASES = [
  ["http://localhost:8898/template-perang.html", 15, "Asli Perang (kontrol)"],
  ["http://localhost:8899/perang-beat135.html", 15, "Perang beat.war=13.5"],
  ["http://localhost:8899/perang-beat14.html", 15, "Perang beat.war=14 (re-apply)"],
  ["http://localhost:8899/perang-beat135-cx.html", 15, "Perang beat13.5 + claude.x"],
  ["http://localhost:8899/kuota-tank30.html", 6, "Kuota tank30"],
  ["http://localhost:8898/template-kuota.html", 6, "Asli Kuota (kontrol)"],
  ["http://localhost:8899/deploy-done18.html", 20, "Deploy beat.done=18"],
  ["http://localhost:8898/template-deploy.html", 20, "Asli Deploy (kontrol)"],
];
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
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
let fails = 0;
for (const [url, t, label] of CASES) {
  errs.length = 0;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => typeof window.renderAt === "function", null, { timeout: 60000 });
    const len = await page.evaluate(() => (typeof LEN === "number" ? LEN : null));
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.waitForTimeout(1200);
    const ok = errs.length === 0 && len !== null;
    if (!ok) fails++;
    console.log(`${ok ? "OK  " : "FAIL"} ${label}: LEN=${len} errs=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
    if (label === "Perang beat.war=13.5") await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-cli-perang.png" });
  } catch (e) {
    fails++;
    console.log(`FAIL ${label}: ${String(e).slice(0, 160)} errs=${errs.join(" | ")}`);
  }
}
await browser.close();
console.log(fails ? `RENDER GAGAL: ${fails}` : "RENDER 8/8 OK");
process.exit(fails ? 1 : 0);
