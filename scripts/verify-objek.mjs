#!/usr/bin/env node
// Uji headless tab Objek: slider langsung terlihat + ketuk objek di preview.
// Usage: npm start (port 3000) lalu: node /tmp/test-objek.mjs
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT = "/home/hatch/workspace/short-studio-react/verification";
await mkdir(OUT, { recursive: true });
const VENDOR = "/tmp/ss-vendor";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) =>
  r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });

async function openTemplate(hash, label) {
  await page.goto(`http://localhost:3000/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  // App hanya membaca hash sekali saat init (tanpa listener hashchange):
  // goto beda hash saja tidak ganti template — reload penuh sesudahnya.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  // Tunggu judul panel berganti ke template baru (bukan sekadar "Preview siap"
  // yang sudah ada dari sebelumnya).
  if (label) {
    await page.waitForFunction((l) => document.body.textContent?.includes(`Comp 1 · ${l}`), label, { timeout: 30000 });
  }
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(400);
}
async function stEval(fn, ...args) {
  return page.evaluate(([fnStr, ...a]) => {
    const pv = document.querySelector("#pv");
    const w = pv?.contentWindow;
    const f = eval(`(${fnStr})`);
    return f(w, ...a);
  }, [fn.toString(), ...args]);
}
const pauseSeek0 = () => stEval((w) => { try { w.__st.pause(); w.__st.seek(0); return true; } catch (e) { return String(e); } });
const shotAt = (x, y) => page.locator("#stage").screenshot({ path: `${OUT}/objek-${x}-${y}.png` });

// ---------- Test A: template-typing — slider claude.x langsung terlihat ----------
await openTemplate("#template-typing", "Mengetik");
await page.click("button.tab:has-text(\"Objek\")");
await page.waitForTimeout(400);
const headerA = await page.textContent(".obj-now");
ok("A1 header Sedang mengedit Maskot oranye", headerA?.includes("Maskot oranye"), headerA?.trim().slice(0, 80));
const pickCountA = await page.locator(".obj-pick-item").count();
ok("A2 pemilih objek typing ada 7 objek", pickCountA === 7, `dapat ${pickCountA}`);
await pauseSeek0();
await page.waitForTimeout(800);
const beforeA = await page.locator("#stage").screenshot();
const sliderA = page.locator('.pane[data-pane="objek"] input[type="range"]').first();
// 0.7 masih dalam batas gabungan |claude.x| + goyangan (0.45) ≤ 1,2 (template tunggal).
// React 19: tulis lewat native setter supaya onChange benar-benar jalan.
await sliderA.evaluate((el) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, "0.7");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(500);
const valA = await page.locator(".prop-ctl-h b").first().textContent();
ok("A3 nilai slider tampil 0.70", valA?.includes("0.7"), `dapat ${valA}`);
// Tunggu remount live: reload iframe + three.js di SwiftShader bisa lambat.
let iframeHtml = null;
for (let i = 0; i < 20; i++) {
  iframeHtml = await stEval((w) => {
    const out = {};
    try { out.mx0 = w.document.documentElement.outerHTML.includes("MX0=0.7"); } catch (e) { out.mx0err = String(e); }
    try { out.hasSt = !!w.__st; } catch (e) { out.stErr = String(e); }
    try { out.canvas = !!w.document.querySelector("canvas"); } catch (e) { out.canvasErr = String(e); }
    return out;
  });
  if (iframeHtml.mx0) break;
  await page.waitForTimeout(500);
}
console.log("   iframe sesudah slider:", JSON.stringify(iframeHtml));
ok("A3b remount live menulis MX0=0.7 ke iframe", iframeHtml.mx0 === true, JSON.stringify(iframeHtml));
await page.waitForTimeout(2000);
const afterA = await page.locator("#stage").screenshot();
ok("A4 preview BERUBAH sesudah slider digeser (live)", !beforeA.equals(afterA), `before ${beforeA.length}B after ${afterA.length}B`);
await writeFile(`${OUT}/objek-a-before.png`, beforeA);
await writeFile(`${OUT}/objek-a-after.png`, afterA);
await page.click("#apply-objek");
await page.waitForTimeout(800);
const stateA = await page.textContent(".apply-state");
ok("A5 Terapkan mengunci (status Tidak ada perubahan)", stateA?.includes("Tidak ada perubahan"), stateA?.trim().slice(0, 90));

// ---------- Test B: template.html (Versus) — ketuk objek di preview ----------
await openTemplate("#template", "Versus");
await page.click("button.tab:has-text(\"Objek\")");
await page.waitForTimeout(400);
const pickCountB = await page.locator(".obj-pick-item").count();
ok("B0 pemilih objek Versus ada 6 objek", pickCountB === 6, `dapat ${pickCountB}`);
const box = await page.locator("#pv").boundingBox();
ok("B0 iframe terlihat", !!box && box.width > 100, JSON.stringify(box));
async function clickPreview(fx, fy) {
  await pauseSeek0();
  await page.waitForTimeout(600);
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(600);
  return (await page.textContent(".obj-now")) || "";
}
const hB1 = await clickPreview(0.25, 0.6);
ok("B1 ketuk kiri → Maskot oranye", hB1.includes("Maskot oranye"), hB1.trim().slice(0, 80));
const hB2 = await clickPreview(0.75, 0.6);
ok("B2 ketuk kanan → Maskot biru", hB2.includes("Maskot biru"), hB2.trim().slice(0, 80));
const hB3 = await clickPreview(0.5, 0.1);
ok("B3 ketuk atas-tengah → Papan skor", hB3.includes("Papan skor"), hB3.trim().slice(0, 80));

// ---------- Test C: tidak ada string teknis di teks UI tab Objek ----------
const banned = ["claude.x", "gs[0]", "lookAt", "caps", "VO", "LEN", "T_BOARD", "envelope", "sinus", "literal", "srcdoc", "props", "JSON", "hex", "SKILL.md", "CC"];
const objekText = await page.locator(".inspector").innerText();
const found = banned.filter((s) => objekText.includes(s));
ok("C1 tanpa string teknis di panel Inspector (tab Objek)", found.length === 0, found.length ? "ketemu: " + found.join(", ") : "");
// Seluruh halaman (drawer + viewer + status bar + tour sudah ditutup).
const pageText = await page.evaluate(() => document.body.innerText);
const foundPage = banned.filter((s) => pageText.includes(s));
ok("C2 tanpa string teknis di seluruh halaman", foundPage.length === 0, foundPage.length ? "ketemu: " + foundPage.join(", ") : "");

console.log("console/page errors:", errors.length ? errors.slice(0, 8) : "(tidak ada)");
await writeFile(`${OUT}/objek-headless.json`, JSON.stringify({ results, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `GAGAL: ${bad.length} dari ${results.length}` : `SEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
