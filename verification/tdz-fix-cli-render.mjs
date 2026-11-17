#!/usr/bin/env node
// Uji render langsung file hasil CLI apply-edit (tanpa studio): Perang +
// Kuota + Deploy dengan beat diubah (kasus TDZ verifikator) harus render
// tanpa ReferenceError/TDZ; file Perang dengan SEMUA prop = nilai default
// harus piksel-identik dengan template asli pada t yang sama (bukti nilai
// default suntikan == literal asli).
//   node verification/tdz-fix-cli-render.mjs
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
import * as mjs from "../scripts/apply-edit.mjs"; // dijalankan dari root repo

const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const TPL = resolve(ROOT, "public/templates");

const changed = [
  ["template-perang.html", { "beat.war": 13.5 }, "/tmp/cli-perang.html", 15],
  ["template-kuota.html", { "beat.frugal": 22 }, "/tmp/cli-kuota.html", 15],
  ["template-deploy.html", { "beat.done": 16 }, "/tmp/cli-deploy.html", 15],
];
// Perang dengan semua prop = nilai saat ini (default): harus identik aslinya.
const perangHtml = await readFile(`${TPL}/template-perang.html`, "utf8");
const parsed = mjs.parseProps(perangHtml, "template-perang.html");
const defaults = {};
for (const p of parsed) if (p.available) defaults[p.def.id] = JSON.parse(JSON.stringify(p.value));
const rDef = mjs.applyEdits(perangHtml, { file: "template-perang.html", props: defaults }, 34);
if (!rDef.ok) { console.log("FAIL generate defaults:", rDef.failed); process.exit(1); }
await writeFile("/tmp/cli-perang-defaults.html", rDef.html);
console.log(`defaults-spec: ${Object.keys(defaults).length} props ditulis kembali (ok=${rDef.ok})`);

for (const [file, props, out] of changed) {
  const html = await readFile(`${TPL}/${file}`, "utf8");
  const mLen = html.match(/(?:^|[^\w$])LEN\s*=\s*([\d.]+)/);
  const r = mjs.applyEdits(html, { file, props }, mLen ? parseFloat(mLen[1]) : 30);
  if (!r.ok) { console.log(`FAIL generate ${file}:`, r.failed); process.exit(1); }
  await writeFile(out, r.html);
  console.log(`OK generate ${file} -> ${out} (${JSON.stringify(props)})`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});

async function renderFile(path, t) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
  });
  await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  const t0 = Date.now();
  await page.goto("file://" + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate((tt) => {
    const w = window;
    let hash = null, ok = false;
    try {
      if (typeof w.renderAt === "function" && typeof LEN === "number") {
        w.renderAt(tt);
        const cv = document.querySelector("canvas");
        hash = cv ? cv.toDataURL().slice(0, 64) : "no-canvas";
        ok = true;
      }
    } catch (e) { return { ok: false, err: String(e).slice(0, 200), LEN: null }; }
    return { ok, hash, LEN: typeof LEN === "number" ? LEN : null, renderAt: typeof w.renderAt };
  }, t);
  const ms = Date.now() - t0;
  await ctx.close();
  return { ...info, errs, ms };
}

const results = [];
for (const [file, , out, t] of changed) {
  const r = await renderFile(out, t);
  const pass = r.ok && r.errs.length === 0;
  console.log(`${pass ? "OK  " : "FAIL"} CLI ${file} t=${t} renderAt=${r.renderAt} LEN=${r.LEN} ${r.ms}mdtk${r.errs.length ? " ERR: " + r.errs.join(" | ") : ""}`);
  results.push({ file, ...r, pass });
}
// Kesetaraan nilai default TIDAK diuji lewat piksel di sini: partikel
// template diinisialisasi acak (rn()/ru()) sehingga dua load file yang
// sama pun berbeda piksel. Buktinya di verification/tdz-fix-probe.mjs
// (FA/mlay/posisi maskot — fungsi murni dari t — identik asli vs defaults).
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? "GAGAL" : "SEMUA UJI CLI-RENDER OK");
process.exit(bad.length ? 1 : 0);
