#!/usr/bin/env node
// Probe deterministik Perang: bandingkan FA(t) + mlay() + posisi maskot
// (fungsi murni dari t) antara template asli, hasil CLI semua-default,
// dan hasil CLI beat.war=13.5 (kontrol positif — harus BERBEDA).
// Piksel tidak bisa dipakai: partikel diinisialisasi acak (rn()/ru()).
//   node verification/tdz-fix-probe.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
async function probe(path) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
  });
  await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  await page.goto("file://" + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const r = (x) => Math.round(x * 1e6) / 1e6;
    const fa = (t) => { const f = FA(t); const o = {}; for (const k of Object.keys(f)) o[k] = Array.isArray(f[k]) ? f[k].map(r) : r(f[k]); return o; };
    window.renderAt(13.2);
    return {
      fa132: fa(13.2), fa208: fa(20.8), fa24: fa(24),
      mlay002: mlay(0, 0, 13.2).map(r), mlay042: mlay(0, 4, 13.2).map(r), mlay122: mlay(1, 2, 13.2).map(r),
      cmPos: cm.position.toArray().map(r), dmPos: dm.position.toArray().map(r),
      fApos: fA.g.position.toArray().map(r),
    };
  });
  await ctx.close();
  return { ...out, errs };
}
const ROOT = "/home/hatch/workspace/short-studio-react/public/templates/template-perang.html";
const a = await probe(ROOT);
const b = await probe("/tmp/cli-perang-defaults.html");
const c = await probe("/tmp/cli-perang.html");
await browser.close();
const j = (o) => JSON.stringify(o);
console.log("asli errs:", a.errs, "| defaults errs:", b.errs, "| war13.5 errs:", c.errs);
for (const k of ["fa132", "fa208", "fa24", "mlay002", "mlay042", "mlay122", "cmPos", "dmPos", "fApos"]) {
  const sameDef = j(a[k]) === j(b[k]);
  const diffWar = j(a[k]) !== j(c[k]);
  console.log(`${sameDef ? "SAMA " : "BEDA!"} defaults ${k} | kontrol beat.war 13.5 ${diffWar ? "berbeda (terdeteksi)" : "SAMA (tidak terdeteksi)"}`);
  if (!sameDef) { console.log("  asli    :", j(a[k])); console.log("  defaults:", j(b[k])); }
}
const allSame = ["fa132", "fa208", "fa24", "mlay002", "mlay042", "mlay122", "cmPos", "dmPos", "fApos"].every((k) => j(a[k]) === j(b[k]));
const anyControl = ["fa132", "mlay002", "mlay042"].some((k) => j(a[k]) !== j(c[k]));
console.log(allSame && anyControl ? "PROBE OK: defaults identik, kontrol terdeteksi" : "PROBE GAGAL");
process.exit(allSame && anyControl ? 0 : 1);
