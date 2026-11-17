#!/usr/bin/env node
// Verifikasi semua template + alur edit teks di Short Studio (React).
// Usage: npm start (terminal lain), lalu: node scripts/verify-all.mjs
// CDN template dialihkan ke vendor lokal (lihat verify-headless.mjs).
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const VENDOR = process.env.VENDOR_DIR || "/tmp/ss-vendor";
const BASE = process.env.STUDIO_URL || "http://localhost:3000";
const registry = JSON.parse(await readFile("public/templates.json", "utf8"));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/meta-chromium/chrome",
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) =>
  r.fulfill({ contentType: "text/css", body: "/* x */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());

const slug = (f) => f.replace(/\.html$/, "");
const results = [];
for (const t of registry) {
  await page.goto(`${BASE}/?v=${Date.now()}#${slug(t.file)}`, { waitUntil: "domcontentloaded" });
  let ok = false;
  try {
    await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
    ok = true;
  } catch { /* keep ok=false */ }
  const info = await page.evaluate(() => {
    const st = document.querySelector("#pv")?.contentWindow?.__st;
    const cv = document.querySelector("#pv")?.contentWindow?.document.querySelector("canvas");
    return st ? { len: st.len(), shots: st.shots().length, caps: st.caps().length, canvas: !!cv } : null;
  });
  results.push({ file: t.file, label: t.label, ok, ...info });
  console.log(`${ok && info ? "OK  " : "FAIL"} ${t.file} len=${info?.len} shots=${info?.shots} caps=${info?.caps} canvas=${info?.canvas}`);
}

// Alur edit teks di template-code: ubah judul -> Terapkan -> judul di iframe berubah.
await page.goto(`${BASE}/?v=edit#template-code`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
await page.click(".tour-skip").catch(() => {});
await page.fill("#fTitle", "Judul Tes React");
await page.click("#apply");
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
await page.waitForTimeout(2500);
const titleInFrame = await page.evaluate(() =>
  document.querySelector("#pv")?.contentWindow?.document.getElementById("title")?.textContent?.trim().slice(0, 60)
);
console.log("judul di iframe setelah Terapkan:", JSON.stringify(titleInFrame));
console.log("errors:", errors.slice(0, 10));
await browser.close();
const failed = results.filter((r) => !r.ok || !r.len);
console.log(failed.length ? `GAGAL: ${failed.length} template` : "SEMUA 12 TEMPLATE OK");
process.exit(failed.length ? 1 : 0);
