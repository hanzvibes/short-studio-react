#!/usr/bin/env node
// Verifikasi headless Short Studio (React): buka studio, tunggu preview siap,
// cek bridge __st, lalu screenshot. Bukan bagian dari studio; alat verifikasi saja.
// Usage:  npm start (di terminal lain) lalu: node scripts/verify-headless.mjs [url] [outdir]
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const url = process.argv[2] || "http://localhost:3000/#template-code";
const outdir = process.argv[3] || "verification";
const VENDOR = process.env.VENDOR_DIR || "/tmp/ss-vendor";
await mkdir(outdir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/meta-chromium/chrome",
  env: {
    ...process.env,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    ALL_PROXY: "",
    all_proxy: "",
    NO_PROXY: "*",
  },
  args: [
    "--no-sandbox",
    "--no-proxy-server",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
// Harness verifikasi SAJA: headless shell di VM ini tidak bisa mencapai CDN
// (ERR_CONNECTION_RESET lewat egress proxy; curl ke host yang sama berhasil).
// Alihkan request CDN template ke salinan three r128 yang diunduh via curl.
// Template di disk TIDAK diubah; ini hanya intersepsi jaringan saat verifikasi.
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) })
);
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) =>
  r.fulfill({ contentType: "text/css", body: "/* font fallback sistem untuk verifikasi headless */" })
);
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200));
});
page.on("requestfailed", (r) => errors.push("reqfail: " + r.url().slice(0, 120) + " :: " + (r.failure()?.errorText || "?")));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

// Tunggu status "Preview siap" (bridge __st ok + LEN/shots/caps terbaca).
try {
  await page.waitForFunction(
    () => document.body.textContent?.includes("Preview siap"),
    null,
    { timeout: 60000 }
  );
} catch {
  console.log("TIMEOUT menunggu Preview siap; status sekarang:", await page.textContent(".statusbar .st-left").catch(() => "?"));
}
await page.waitForTimeout(6000); // beri waktu three.js render frame pertama
// Tutup tur singkat (muncul otomatis di kunjungan pertama) supaya tidak menutupi preview.
await page.click(".tour-skip").catch(() => {});
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const pv = document.querySelector("#pv");
  const w = pv?.contentWindow;
  const st = w?.__st;
  const cv = w?.document.querySelector("canvas");
  let px = null;
  try {
    if (cv) {
      const g = cv.getContext("webgl") || cv.getContext("webgl2");
      px = g ? "webgl-context-ok" : "no-webgl-context";
    }
  } catch { /* ignore */ }
  return {
    status: document.querySelector(".statusbar .st-left")?.textContent?.trim(),
    statusInfo: document.querySelector(".statusbar .st-mid")?.textContent?.trim(),
    title: document.title,
    tplCount: document.querySelectorAll("#tplList .tpl").length,
    shotClips: document.querySelectorAll(".clip.shot[data-kind]").length,
    capClips: document.querySelectorAll(".clip.cap[data-kind]").length,
    bridge: st ? { ok: st.ok(), len: st.len(), shots: st.shots().length, caps: st.caps().length, t: st.gT() } : null,
    canvas: cv ? { w: cv.width, h: cv.height, px } : null,
    nowCap: document.querySelector("#nowTxt")?.textContent,
    inspector: document.querySelector("#compDur")?.textContent,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `${outdir}/studio-template-code.png` });
const stage = await page.$("#stage");
if (stage) await stage.screenshot({ path: `${outdir}/stage-template-code.png` });

// Uji transport: seek ke tengah adegan (t=12: maskot + papan skor harus terlihat),
// lalu play 3 detik — waktu harus maju.
await page.evaluate(() => {
  const pv = document.querySelector("#pv");
  const st = pv?.contentWindow?.__st;
  st?.seek(12);
});
await page.waitForTimeout(1500);
const stage2 = await page.$("#stage");
if (stage2) await stage2.screenshot({ path: `${outdir}/stage-template-code-t12.png` });
await page.evaluate(() => {
  const pv = document.querySelector("#pv");
  pv?.contentWindow?.__st?.play();
});
await page.waitForTimeout(3000);
const tAfter = await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.gT());
console.log("t setelah play 3s:", tAfter);
await page.screenshot({ path: `${outdir}/stage-template-code-playing.png` });
await writeFile(`${outdir}/headless-info.json`, JSON.stringify({ info, tAfter, errors: errors.slice(0, 10) }, null, 2));
console.log("errors:", errors.slice(0, 10));
await browser.close();
