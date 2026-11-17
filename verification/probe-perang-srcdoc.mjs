#!/usr/bin/env node
// Probe: baca srcdoc iframe perang dari studio (tanpa edit) + dari CLI apply-edit.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(15000);
const srcdoc = await page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
await writeFile("/tmp/perang-srcdoc.html", srcdoc);
console.log("srcdoc panjang:", srcdoc.length);
const idx = srcdoc.indexOf("T_WAR");
console.log("T_WAR pertama di offset:", idx);
if (idx >= 0) console.log("konteks:", JSON.stringify(srcdoc.slice(Math.max(0, idx - 300), idx + 300)));
// semua kemunculan T_WAR dengan nomor baris
const lines = srcdoc.split("\n");
lines.forEach((l, i) => { if (l.includes("T_WAR")) console.log(`baris ${i + 1}: ${l.trim().slice(0, 200)}`); });
await browser.close();
