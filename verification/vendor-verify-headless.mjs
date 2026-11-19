#!/usr/bin/env node
// VERIFIKASI INDEPENDEN vendor CDN (bukan bagian produk).
// Usage:  npm start -- -p 3101  (terminal lain)
//         BLOCK_CDN=1 node verification/vendor-verify-headless.mjs   -> CDN diblokir (abort)
//         BLOCK_CDN=0 node verification/vendor-verify-headless.mjs   -> CDN diizinkan (regresi)
// Mencatat SEMUA request jaringan per template; screenshot per template.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = process.env.STUDIO_URL || "http://localhost:3101";
const OUT = "verification";
const BLOCK = process.env.BLOCK_CDN !== "0";
const registry = JSON.parse(await readFile("public/templates.json", "utf8"));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  args: [
    "--no-sandbox",
    "--no-proxy-server",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
  ],
  env: {
    ...process.env,
    HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "",
    ALL_PROXY: "", all_proxy: "", NO_PROXY: "*",
  },
});

const results = [];
for (const t of registry) {
  const slug = t.file.replace(/\.html$/, "");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = []; // {url, status}
  const blockedAttempts = [];
  page.on("request", (r) => {
    const u = r.url();
    if (
      u.includes("cdnjs.cloudflare.com") ||
      u.includes("cdn.jsdelivr.net") ||
      u.includes("fonts.googleapis.com") ||
      u.includes("fonts.gstatic.com")
    ) blockedAttempts.push(u);
  });
  page.on("response", (r) => reqs.push({ url: r.url(), status: r.status() }));
  if (BLOCK) {
    await page.route("https://cdnjs.cloudflare.com/**", (r) => r.abort());
    await page.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?v=vendor${BLOCK ? "blk" : "ok"}#${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  let ready = false;
  try {
    await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
    ready = true;
  } catch { /* keep false */ }
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const pv = document.querySelector("#pv");
    const w = pv?.contentWindow;
    const st = w?.__st;
    const cv = w?.document.querySelector("canvas");
    return {
      status: document.querySelector(".statusbar .st-left")?.textContent?.trim() || null,
      bridge: st ? { ok: st.ok(), len: st.len(), shots: st.shots().length, caps: st.caps().length } : null,
      canvas: cv ? { w: cv.width, h: cv.height } : null,
    };
  });
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(500);
  const shot = `${OUT}/vendor-cdn-${BLOCK ? "blocked" : "allowed"}-${slug}.png`;
  await page.screenshot({ path: shot });
  const vendorReqs = reqs.filter((r) => r.url.includes("/vendor/"));
  const vendorOk = vendorReqs.filter((r) => r.status === 200).length;
  const vendorFiles = [...new Set(vendorReqs.map((r) => r.url.split("/vendor/")[1]))].sort();
  const cdnThreeAttempts = blockedAttempts.filter((u) => u.includes("cdnjs.cloudflare.com") || u.includes("cdn.jsdelivr.net"));
  const rec = {
    file: t.file, label: t.label, kind: t.kind, ready,
    bridgeOk: info.bridge?.ok ?? null, len: info.bridge?.len ?? null,
    shots: info.bridge?.shots ?? null, caps: info.bridge?.caps ?? null,
    canvas: info.canvas, status: info.status,
    vendorReqs: vendorReqs.length, vendorOk200: vendorOk,
    vendorFiles, cdnThreeAttempts: cdnThreeAttempts.length,
    cdnThreeUrls: cdnThreeAttempts, fontAttempts: blockedAttempts.filter((u) => u.includes("fonts.g")).length,
    errors: errors.slice(0, 5), screenshot: shot,
  };
  results.push(rec);
  console.log(`${ready && info.bridge?.ok ? "OK  " : "FAIL"} ${t.file} len=${rec.len} canvas=${!!rec.canvas} vendor=${vendorOk}/${vendorReqs.length} files=${vendorFiles.length} cdnThree=${cdnThreeAttempts.length} fonts=${rec.fontAttempts} err=${errors.length}`);
  await page.close();
}
await browser.close();
const suffix = BLOCK ? "blocked" : "allowed";
await writeFile(`${OUT}/vendor-verify-headless-${suffix}.json`, JSON.stringify({ blockCdn: BLOCK, base: BASE, results }, null, 2));
const failed = results.filter((r) => !(r.ready && r.bridgeOk && r.canvas && r.vendorOk200 >= 13 && r.cdnThreeAttempts === 0));
console.log(failed.length ? `GAGAL: ${failed.length} template` : `SEMUA ${results.length} TEMPLATE OK (CDN ${BLOCK ? "diblokir" : "diizinkan"})`);
process.exit(failed.length ? 1 : 0);
