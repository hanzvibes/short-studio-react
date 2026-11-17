#!/usr/bin/env node
// Verifikasi INDEPENDEN props-all Short Studio React (bukan re-run klaim implementor).
// Menulis hasil ke verification/props-all-verify-headless.json + screenshot props-all-*.png
// Usage: npm start (port 3000) lalu: node verification/verify-props-all.mjs
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const OUT = "/home/hatch/workspace/short-studio-react/verification";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
await mkdir(OUT, { recursive: true });

const results = [];
const errors = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra: String(extra).slice(0, 400) });
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 200) : ""}`);
};

// ---------- PNG decode + pixel diff (murni node:zlib, tanpa dep baru) ----------
function decodePNG(buf) {
  let pos = 8; let w = 0, h = 0, bitDepth = 0, colorType = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`PNG tak didukung: bitDepth=${bitDepth} colorType=${colorType}`);
  const ch = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch; const out = new Uint8Array(w * h * 4);
  let p = 0;
  const paeth = (a, b, c) => { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const prev = y === 0 ? null : out.subarray((y - 1) * w * 4, y * w * 4);
    for (let x = 0; x < stride; x++) {
      let v = row[x];
      const a = x >= ch ? out[y * w * 4 + x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= ch && prev ? prev[x - ch] : 0;
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255; else if (f === 4) v = (v + paeth(a, b, c)) & 255;
      const px = (y * w + Math.floor(x / ch)) * 4 + (x % ch);
      out[px] = v;
    }
    for (let x = 0; x < w; x++) if (ch === 3) out[(y * w + x) * 4 + 3] = 255;
  }
  return { w, h, data: out };
}
function pixelDiff(a, b) {
  const A = decodePNG(a), B = decodePNG(b);
  if (A.w !== B.w || A.h !== B.h) return { changed: -1, pct: -1, note: `ukuran beda ${A.w}x${A.h} vs ${B.w}x${B.h}` };
  let changed = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let i = 0; i < A.w * A.h; i++) {
    const d = Math.max(Math.abs(A.data[i * 4] - B.data[i * 4]), Math.abs(A.data[i * 4 + 1] - B.data[i * 4 + 1]), Math.abs(A.data[i * 4 + 2] - B.data[i * 4 + 2]));
    if (d > 10) { changed++; const x = i % A.w, y = Math.floor(i / A.w); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return { changed, pct: +(100 * changed / (A.w * A.h)).toFixed(2), box: changed ? `${minX},${minY}-${maxX},${maxY}` : "-" };
}
function srcdocDiff(before, after) {
  let i = 0; while (i < Math.min(before.length, after.length) && before[i] === after[i]) i++;
  let j = 0; while (j < Math.min(before.length - i, after.length - i) && before[before.length - 1 - j] === after[after.length - 1 - j]) j++;
  const b = before.slice(Math.max(0, i - 60), before.length - j + 60);
  const a = after.slice(Math.max(0, i - 60), after.length - j + 60);
  return { before: b.replace(/\s+/g, " ").slice(0, 300), after: a.replace(/\s+/g, " ").slice(0, 300) };
}

// ---------- browser ----------
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());

async function openTemplate(hash, label) {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`http://localhost:3000/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  if (label) await page.waitForFunction((l) => document.body.textContent?.includes(`Comp 1 · ${l}`), label, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(300);
}
async function stEval(fn, ...args) {
  return page.evaluate(([fnStr, ...a]) => {
    const pv = document.querySelector("#pv");
    const w = pv?.contentWindow;
    const f = eval(`(${fnStr})`);
    return f(w, ...a);
  }, [fn.toString(), ...args]);
}
const pauseSeek = (t) => stEval((w, tt) => { try { w.__st.pause(); w.__st.seek(tt); return true; } catch (e) { return String(e); } }, t);
const srcdoc = () => page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
const stageShot = async (name) => {
  const path = `${OUT}/props-all-${name}.png`;
  const buf = await page.locator("#stage").screenshot({ path });
  return { path, buf };
};
async function clickTab(name) {
  await page.locator('[role="tab"]', { hasText: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(400);
}
async function pickObj(name) {
  await page.locator(".obj-pick-item", { hasText: name }).first().click();
  await page.waitForTimeout(400);
  return (await page.textContent(".obj-now")) || "";
}
async function sliderVal(label) {
  return page.evaluate((lbl) => {
    for (const d of document.querySelectorAll(".prop-ctl")) {
      const s = d.querySelector(".prop-ctl-h > span");
      if (s && s.textContent.trim() === lbl) { const b = d.querySelector(".prop-ctl-h > b"); return b ? b.textContent.trim() : null; }
    }
    return null;
  }, label);
}
// Ukur latensi pratinjau langsung: isi slider, polling srcdoc sampai berubah.
async function setSliderMeasured(label, value, expectRe) {
  const before = await srcdoc();
  const t0 = Date.now();
  await page.locator(`input[type="range"][aria-label="${label}"]`).fill(String(value));
  let after = before, latency = -1;
  for (let k = 0; k < 30; k++) {
    await page.waitForTimeout(100);
    after = await srcdoc();
    if (expectRe && expectRe.test(after)) { latency = Date.now() - t0; break; }
    if (!expectRe && after !== before) { latency = Date.now() - t0; break; }
  }
  const shown = await sliderVal(label);
  return { before, after, latency, shown };
}

const BANNED = ["claude.x", "gs[0]", "lookAt", "caps", "VO", "LEN", "T_BOARD", "envelope", "sinus", "literal", "srcdoc", "props"];
async function bannedSweep(scope) {
  const text = await page.evaluate(() => document.body.innerText);
  const found = BANNED.filter((s) => text.includes(s));
  ok(`NOL-teknis [${scope}]`, found.length === 0, found.length ? "LOLOS: " + found.join(", ") : "bersih");
  return found;
}

// ================= BAGIAN A: bukti per kategori (1366x768) =================
console.log("\n== BAGIAN A: prop yang dulu diblokir ==");

// A1 — X maskot tunggal: template-typing claude.x 0 -> 0.7
await openTemplate("#template-typing", "Mengetik");
await clickTab("Objek");
let h = await pickObj("Maskot oranye");
ok("A1a header Sedang mengedit: Maskot oranye", h.includes("Sedang mengedit: Maskot oranye"), h.trim().slice(0, 90));
await pauseSeek(5); await page.waitForTimeout(500);
const a1Before = await stageShot("typing-x-before");
const a1 = await setSliderMeasured("Geser kiri-kanan", 0.7, /MX0\s*=\s*0\.7/);
ok("A1b nilai tampil 0.70", a1.shown === "0.70", "dapat " + a1.shown);
ok("A1c srcdoc mengandung MX0=0.7", /MX0\s*=\s*0\.7/.test(a1.after), "latensi " + a1.latency + " mdtk");
ok("A1d latensi pratinjau < 2000 mdtk", a1.latency > 0 && a1.latency < 2000, a1.latency + " mdtk");
await pauseSeek(5); await page.waitForTimeout(500);
const a1After = await stageShot("typing-x-after");
const d1 = pixelDiff(a1Before.buf, a1After.buf);
ok("A1e preview BERUBAH (piksel)", d1.changed > 50, `${d1.changed} px (${d1.pct}%), box ${d1.box}`);
// reset per kontrol
await page.locator('button[title="Kembalikan ke nilai asli"]').first().click();
await page.waitForTimeout(900);
const a1ResetVal = await sliderVal("Geser kiri-kanan");
const a1ResetSrc = await srcdoc();
ok("A1f reset ↺ kembalikan ke 0.00", a1ResetVal === "0.00", "dapat " + a1ResetVal);
ok("A1g reset hapus MX0=0.7 dari srcdoc", !/MX0\s*=\s*0\.7/.test(a1ResetSrc), "");

// A2 — skor papan non-code: template-code board.claude.final "Performa" 88 -> 50
await openTemplate("#template-code", "Adu Kode");
await clickTab("Objek");
await pickObj("Papan skor");
await pauseSeek(25); await page.waitForTimeout(500);
const a2Before = await stageShot("code-skor-before");
const a2 = await setSliderMeasured("Angka akhir oranye — Performa", 50, /96,\s*94,\s*50/);
const a2Shown = await page.evaluate(() => {
  for (const d of document.querySelectorAll(".prop-sub")) {
    const s = d.querySelector(".prop-ctl-h > span");
    if (s && s.textContent.trim() === "Performa") return d.querySelector(".prop-ctl-h > b")?.textContent.trim();
  } return null;
});
ok("A2b nilai Performa tampil 50", a2Shown === "50", "dapat " + a2Shown);
ok("A2c srcdoc mengandung [96,94,50]", /96,\s*94,\s*50/.test(a2.after), "latensi " + a2.latency + " mdtk");
await pauseSeek(25); await page.waitForTimeout(500);
const a2After = await stageShot("code-skor-after");
const d2 = pixelDiff(a2Before.buf, a2After.buf);
ok("A2d preview BERUBAH (piksel, papan t=25)", d2.changed > 50, `${d2.changed} px (${d2.pct}%), box ${d2.box}`);

// A3 — konstanta beat: template-sleep beat.sleep 28 -> 26
await openTemplate("#template-sleep", "Tidur");
await clickTab("Objek");
await pickObj("Jalan cerita");
await pauseSeek(27); await page.waitForTimeout(500);
const a3Before = await stageShot("sleep-beat-before");
const a3 = await setSliderMeasured("Waktu tidur lagi", 26, null);
const diff3 = srcdocDiff(a3.before, a3.after);
ok("A3a nilai tampil 26", a3.shown === "26", "dapat " + a3.shown);
ok("A3b srcdoc berubah di sekitar beat tidur", /26/.test(diff3.after), "sesudah: " + diff3.after.slice(0, 160));
await pauseSeek(27); await page.waitForTimeout(500);
const a3After = await stageShot("sleep-beat-after");
const d3 = pixelDiff(a3Before.buf, a3After.buf);
ok("A3c preview BERUBAH di t=27 (sudah tidur vs masih kerja)", d3.changed > 50, `${d3.changed} px (${d3.pct}%), box ${d3.box}`);

// A4 — ekspresi wajah: template-code face.codex -1 -> 2 (Senang)
await openTemplate("#template-code", "Adu Kode");
await clickTab("Objek");
await pickObj("Maskot biru");
const fBefore = await srcdoc();
await pauseSeek(10); await page.waitForTimeout(500);
const a4Before = await stageShot("code-face-before");
await page.locator('.choice-row[aria-label="Wajah di layar biru"] button', { hasText: "Senang" }).click();
await page.waitForTimeout(900);
const fAfter = await srcdoc();
const diff4 = srcdocDiff(fBefore, fAfter);
ok("A4a pilihan Senang aktif", await page.evaluate(() => {
  const b = [...document.querySelectorAll('.choice-row[aria-label="Wajah di layar biru"] button')].find((x) => x.textContent.trim() === "Senang");
  return b?.getAttribute("aria-pressed") === "true";
}), "");
ok("A4b srcdoc berubah (wajah)", diff4.before !== diff4.after, "sesudah: " + diff4.after.slice(0, 160));
await pauseSeek(10); await page.waitForTimeout(500);
const a4After = await stageShot("code-face-after");
const d4 = pixelDiff(a4Before.buf, a4After.buf);
ok("A4c preview BERUBAH (piksel, wajah t=10)", d4.changed > 20, `${d4.changed} px (${d4.pct}%), box ${d4.box}`);

// A5 — boss tidur: template-sleep boss.scale 1 -> 1.3
await openTemplate("#template-sleep", "Tidur");
await clickTab("Objek");
await pickObj("Bos");
await pauseSeek(13); await page.waitForTimeout(500);
const a5Before = await stageShot("sleep-boss-before");
const a5 = await setSliderMeasured("Besar-kecil", 1.3, /boss\.scale\.setScalar\(1\.3\)/);
ok("A5a nilai tampil 1.30 ×", a5.shown === "1.30 ×", "dapat " + a5.shown);
ok("A5b srcdoc mengandung boss.scale.setScalar(1.3)", /boss\.scale\.setScalar\(1\.3\)/.test(a5.after), "latensi " + a5.latency + " mdtk");
await pauseSeek(13); await page.waitForTimeout(500);
const a5After = await stageShot("sleep-boss-after");
const d5 = pixelDiff(a5Before.buf, a5After.buf);
ok("A5c preview BERUBAH (piksel, bos t=13)", d5.changed > 50, `${d5.changed} px (${d5.pct}%), box ${d5.box}`);

// A6 — benteng perang: template-perang fort.size 1 -> 1.3
await openTemplate("#template-perang", "Perang");
await clickTab("Objek");
await pickObj("Benteng");
await pauseSeek(15); await page.waitForTimeout(500);
const a6Before = await stageShot("perang-benteng-before");
const a6 = await setSliderMeasured("Besar-kecil", 1.3, null);
const diff6 = srcdocDiff(a6.before, a6.after);
ok("A6a nilai tampil 1.30 ×", a6.shown === "1.30 ×", "dapat " + a6.shown);
ok("A6b srcdoc berubah (benteng)", /1\.3/.test(diff6.after), "sesudah: " + diff6.after.slice(0, 160));
await pauseSeek(15); await page.waitForTimeout(500);
const a6After = await stageShot("perang-benteng-after");
const d6 = pixelDiff(a6Before.buf, a6After.buf);
ok("A6c preview BERUBAH (piksel, benteng t=15)", d6.changed > 50, `${d6.changed} px (${d6.pct}%), box ${d6.box}`);

// A7 — tangki kuota: template-kuota tank.curve baris 3 sisa 80 -> 30
await openTemplate("#template-kuota", "Kuota");
await clickTab("Objek");
await pickObj("Tangki kuota");
await pauseSeek(6); await page.waitForTimeout(500);
const a7Before = await stageShot("kuota-tank-before");
const a7 = await setSliderMeasured("Baris 3 sisa kuota", 30, null);
const diff7 = srcdocDiff(a7.before, a7.after);
ok("A7a srcdoc berubah (kurva tangki)", /30/.test(diff7.after), "sesudah: " + diff7.after.slice(0, 200));
await pauseSeek(6); await page.waitForTimeout(500);
const a7After = await stageShot("kuota-tank-after");
const d7 = pixelDiff(a7Before.buf, a7After.buf);
ok("A7b preview BERUBAH (piksel, tangki t=6)", d7.changed > 50, `${d7.changed} px (${d7.pct}%), box ${d7.box}`);

// ================= BAGIAN B: ketuk preview + fokus + nol-teknis (1366x768) =================
console.log("\n== BAGIAN B: ketuk, fokus, nol-teknis (1366) ==");
await openTemplate("#template", "Versus");
await clickTab("Objek");
await pickObj("Papan skor"); // pastikan mulai dari objek lain
async function tapPreview(fx, fy) {
  await pauseSeek(0); await page.waitForTimeout(400);
  const box = await page.locator("#stage").boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(500);
  return (await page.textContent(".obj-now")) || "";
}
let t1 = await tapPreview(0.25, 0.6);
ok("B1 ketuk kiri-bawah → Maskot oranye", t1.includes("Maskot oranye"), t1.trim().slice(0, 60));
let t2 = await tapPreview(0.75, 0.6);
ok("B2 ketuk kanan-bawah → Maskot biru", t2.includes("Maskot biru"), t2.trim().slice(0, 60));
let t3 = await tapPreview(0.5, 0.1);
ok("B3 ketuk atas-tengah → Papan skor", t3.includes("Papan skor"), t3.trim().slice(0, 60));
let t4 = await tapPreview(0.5, 0.95);
ok("B4 ketuk bawah-tengah (zona kosong?) tidak crash", true, "hasil: " + t4.trim().slice(0, 60));

// Fokus viewer
const stageBefore = await page.locator("#stage").boundingBox();
await page.locator('button[aria-label^="Fokus viewer"]').click();
await page.waitForTimeout(700);
const stageFocus = await page.locator("#stage").boundingBox();
ok("B5 fokus viewer memperbesar stage", stageFocus.height > stageBefore.height * 1.2, `${Math.round(stageBefore.width)}x${Math.round(stageBefore.height)} → ${Math.round(stageFocus.width)}x${Math.round(stageFocus.height)}`);
await page.locator("#stage").screenshot({ path: `${OUT}/props-all-focus-1366.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
const stageAfterEsc = await page.locator("#stage").boundingBox();
ok("B6 Esc keluar dari fokus viewer", Math.abs(stageAfterEsc.height - stageBefore.height) < 5, `tinggi kembali ${Math.round(stageAfterEsc.height)}`);

// Nol-teknis: semua tab + dialog di 1366
await clickTab("Objek"); await bannedSweep("1366 tab Objek");
await clickTab("Teks"); await bannedSweep("1366 tab Teks");
await clickTab("Shot"); await bannedSweep("1366 tab Shot");
await clickTab("Caption"); await bannedSweep("1366 tab Caption");
// dialog Ekspor MP4
await page.locator("#expBtn, button[aria-label='Ekspor MP4']").first().click().catch(() => {});
await page.waitForTimeout(400);
const expOpen = await page.evaluate(() => !!document.querySelector("dialog.dlg"));
if (expOpen) { await bannedSweep("1366 dialog Ekspor"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
else ok("B7 dialog Ekspor terbuka", false, "tombol ekspor tidak ketemu — dicek manual di bawah");
// dialog Pintasan keyboard
await page.locator("#keysBtn").click(); await page.waitForTimeout(300);
await bannedSweep("1366 dialog Pintasan");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// palet perintah Ctrl+K
await page.keyboard.press("Control+k"); await page.waitForTimeout(400);
await bannedSweep("1366 palet Ctrl+K");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);

// ================= BAGIAN C: 390px portrait =================
console.log("\n== BAGIAN C: 390px portrait ==");
await page.setViewportSize({ width: 390, height: 844 });
await openTemplate("#template-typing", "Mengetik");
await clickTab("Objek");
const cHead1 = await pickObj("Maskot oranye");
ok("C1a header 390: Sedang mengedit Maskot oranye", cHead1.includes("Sedang mengedit: Maskot oranye"), cHead1.trim().slice(0, 70));
const cHead2 = await pickObj("Cangkir");
ok("C1b ganti objek → header jadi Cangkir", cHead2.includes("Sedang mengedit: Cangkir"), cHead2.trim().slice(0, 70));
await pickObj("Maskot oranye");
await pauseSeek(5); await page.waitForTimeout(500);
const cBefore = await stageShot("390-typing-x-before");
const c1 = await setSliderMeasured("Geser kiri-kanan", -0.7, /MX0\s*=\s*-0\.7/);
ok("C2a slider 390: nilai tampil -0.70", c1.shown === "-0.70", "dapat " + c1.shown);
ok("C2b slider 390: srcdoc MX0=-0.7", /MX0\s*=\s*-0\.7/.test(c1.after), "latensi " + c1.latency + " mdtk");
await pauseSeek(5); await page.waitForTimeout(500);
const cAfter = await stageShot("390-typing-x-after");
const dc = pixelDiff(cBefore.buf, cAfter.buf);
ok("C2c slider 390: preview BERUBAH", dc.changed > 20, `${dc.changed} px (${dc.pct}%)`);
// ketuk preview 390 (Versus)
await openTemplate("#template", "Versus");
await clickTab("Objek");
const cT1 = await tapPreview(0.25, 0.6);
ok("C3a ketuk 390 kiri → Maskot oranye", cT1.includes("Maskot oranye"), cT1.trim().slice(0, 60));
const cT2 = await tapPreview(0.75, 0.6);
ok("C3b ketuk 390 kanan → Maskot biru", cT2.includes("Maskot biru"), cT2.trim().slice(0, 60));
// drawer 390
await page.locator("#menu").click(); await page.waitForTimeout(500);
const drawerOpen = await page.evaluate(() => document.body.classList.contains("drawer-open"));
await page.locator("#stage").screenshot({ path: `${OUT}/props-all-390-drawer-open.png` });
ok("C4a drawer 390 terbuka (body.drawer-open)", drawerOpen === true, "");
await page.locator("#menu").click(); await page.waitForTimeout(500);
const drawerClosed = await page.evaluate(() => document.body.classList.contains("drawer-closed"));
ok("C4b drawer 390 tertutup lagi", drawerClosed === true, "");
// tema
const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
await page.locator("#themeBtn").click(); await page.waitForTimeout(400);
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
ok("C5 tema bisa diganti", themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);
await page.locator("#stage").screenshot({ path: `${OUT}/props-all-390-theme-${themeAfter}.png` });
await page.locator("#themeBtn").click(); await page.waitForTimeout(300);
// nol-teknis 390
await clickTab("Teks"); await bannedSweep("390 tab Teks");
await clickTab("Shot"); await bannedSweep("390 tab Shot");
await clickTab("Caption"); await bannedSweep("390 tab Caption");
await clickTab("Objek"); await bannedSweep("390 tab Objek");

// ================= BAGIAN D: regresi alur lama (390) =================
console.log("\n== BAGIAN D: regresi ==");
// D1 caption: edit caption pertama -> Terapkan -> terlihat di preview
await openTemplate("#template-code", "Adu Kode");
await clickTab("Caption");
const capInput = page.locator('input[aria-label="Teks caption 1"]');
const capOrig = await capInput.inputValue();
const CAP_BARU = "Verifikasi caption 23:26";
await capInput.fill(CAP_BARU);
await page.locator("#apply-cap").click();
await page.waitForTimeout(1200);
const srcAfterCap = await srcdoc();
ok("D1a caption baru masuk srcdoc sesudah Terapkan", srcAfterCap.includes(CAP_BARU), "");
await pauseSeek(4); await page.waitForTimeout(600);
const subText = await stEval((w) => { const el = w.document.querySelector("#sub") || w.document.querySelector("#cap"); return el ? el.textContent : "(tidak ada #sub/#cap)"; });
ok("D1b caption baru tampil di preview (t=4)", String(subText).includes(CAP_BARU) || String(subText).includes("Verifikasi caption"), "sub: " + String(subText).slice(0, 80));
await page.locator("#stage").screenshot({ path: `${OUT}/props-all-caption-applied.png` });
// D2 shot: ubah Shot 2 mulai +0.2 -> Terapkan -> srcdoc berubah
await clickTab("Shot");
const shot2 = page.locator('input[aria-label="Shot 2 mulai"]');
const shot2Orig = parseFloat(await shot2.inputValue());
const shot2Baru = +(shot2Orig + 0.2).toFixed(1);
const srcBeforeShot = await srcdoc();
await shot2.fill(String(shot2Baru));
await page.locator("#apply-shot").click();
await page.waitForTimeout(1200);
const srcAfterShot = await srcdoc();
const diffShot = srcdocDiff(srcBeforeShot, srcAfterShot);
ok("D2 shot 2 mulai berubah di srcdoc", diffShot.before !== diffShot.after && String(shot2Baru).length > 0, `baru=${shot2Baru} sesudah: ` + diffShot.after.slice(0, 160));
// D3 simpan sebagai video baru -> reload -> entri bertahan
await page.locator("button:has-text('+ Simpan')").first().click().catch(() => {});
await page.waitForTimeout(400);
// tombol simpan ada di toolbar? cari berdasarkan teks dialog
const saveOpened = await page.evaluate(() => document.body.textContent?.includes("Simpan sebagai video baru"));
if (!saveOpened) {
  // coba tombol dengan title/aria lain
  await page.locator('[aria-label*="Simpan"], button[title*="Simpan"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
}
const dlgOpen = await page.evaluate(() => !!document.querySelector("#mineH"));
ok("D3a dialog Simpan sebagai video baru terbuka", dlgOpen, "");
if (dlgOpen) {
  await page.locator(".dlg input").first().fill("Verifikasi Props-All");
  await page.locator(".dlg button:has-text('Simpan video')").click();
  await page.waitForTimeout(800);
  const mineCount = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("ss.mine.v1") || "[]").length; } catch { return -1; } });
  ok("D3b entri tersimpan di localStorage ss.mine.v1", mineCount >= 1, "jumlah: " + mineCount);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.click(".tour-skip").catch(() => {});
  const mineVisible = await page.evaluate(() => document.body.textContent?.includes("Verifikasi Props-All"));
  ok("D3c sesudah reload entri masih tampil di galeri", mineVisible === true, "");
  await page.screenshot({ path: `${OUT}/props-all-mine-after-reload.png`, fullPage: false });
}

// ================= RINGKASAN =================
console.log("\n== console/page errors selama semua pengujian: " + errors.length + " ==");
errors.slice(0, 10).forEach((e) => console.log("  ERR: " + e));
ok("E1 nol console/page error di semua lebar yang diuji", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "");
await writeFile(`${OUT}/props-all-verify-headless.json`, JSON.stringify({ results, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `\nGAGAL: ${bad.length} dari ${results.length}` : `\nSEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
