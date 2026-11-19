#!/usr/bin/env node
// VERIFIKASI INDEPENDEN export standalone (bukan bagian produk).
// Buka file .html hasil apply-edit via HTTP lokal; CDN three.js dipenuhi
// dari salinan /tmp/cdn-check yang sudah terbukti byte-identik dengan CDN
// resmi (sha256 MATCH 13/13) — browser headless di VM ini tidak bisa
// mencapai CDN langsung (ERR_CONNECTION_RESET via egress proxy).
// Bukti yang dicari: file MEMINTA URL CDN (bukan /vendor/), __st.ok() true.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const CDN = "/tmp/cdn-check";
const browser = await chromium.launch({
  executablePath:
    "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = [];
page.on("request", (r) => reqs.push(r.url()));
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${CDN}/cdn-three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "").split("/").pop();
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${CDN}/cdn-${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
await page.goto("http://localhost:3102/vendor-export-test.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  return { hasRenderAt: typeof window.renderAt === "function",
           hasTHREE: typeof window.THREE !== "undefined",
           canvas: cv ? { w: cv.width, h: cv.height } : null,
           title: document.getElementById("title")?.textContent?.trim()?.slice(0, 60) || null };
});
// Render satu frame via API template sendiri (renderAt) — bukti three.js jalan.
let renderAtOk = false;
try {
  await page.evaluate(() => window.renderAt(12));
  await page.waitForTimeout(1500);
  renderAtOk = await page.evaluate(() => !!document.querySelector("canvas"));
} catch (e) { errors.push("renderAt: " + String(e).slice(0, 200)); }
await page.screenshot({ path: "verification/vendor-export-render.png" });
const cdnThree = reqs.filter((u) => u.includes("cdnjs.cloudflare.com") || u.includes("cdn.jsdelivr.net"));
const vendor = reqs.filter((u) => u.includes("/vendor/"));
console.log(JSON.stringify({ ...info, renderAtOk, cdnThreeRequests: cdnThree.length, vendorRequests: vendor.length, errors: errors.slice(0, 5) }, null, 2));
await writeFile("verification/vendor-export-render.json", JSON.stringify({ ...info, renderAtOk, cdnThreeRequests: cdnThree.length, cdnThree, vendorRequests: vendor.length, errors }, null, 2));
await browser.close();
const pass = info.hasRenderAt === true && info.hasTHREE === true && renderAtOk && !!info.canvas && cdnThree.length === 13 && vendor.length === 0;
console.log(pass ? "EXPORT RENDER OK" : "EXPORT RENDER GAGAL");
process.exit(pass ? 0 : 1);
