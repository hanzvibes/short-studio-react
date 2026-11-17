#!/usr/bin/env node
// Verifikasi INDEPENDEN lanjutan (bagian 2): perbaikan uji A2/A3, A6/A7,
// ketuk + fokus + nol-teknis (1366), alur 390px, regresi. Tulis JSON + PNG ke verification/.
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
function decodePNG(buf) {
  let pos = 8; let w = 0, h = 0, bitDepth = 0, colorType = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
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
  return { before: before.slice(Math.max(0, i - 60), before.length - j + 60).replace(/\s+/g, " ").slice(0, 300), after: after.slice(Math.max(0, i - 60), after.length - j + 60).replace(/\s+/g, " ").slice(0, 300) };
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
async function routeVendor(p) {
  await p.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await p.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
  });
  await p.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
  await p.route("https://fonts.gstatic.com/**", (r) => r.abort());
}
await routeVendor(page);
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
const BANNED = ["claude.x", "gs[0]", "lookAt", "caps", "VO", "LEN", "T_BOARD", "envelope", "sinus", "literal", "srcdoc", "props"];
async function bannedSweep(scope) {
  const text = await page.evaluate(() => document.body.innerText);
  const found = BANNED.filter((s) => text.includes(s));
  ok(`NOL-teknis [${scope}]`, found.length === 0, found.length ? "LOLOS: " + found.join(", ") : "bersih");
  return found;
}
// Nilai sub-baris skor yang benar: cari .prop-ctl dengan header == plain, lalu sub == label.
async function scoreVal(plain, sub) {
  return page.evaluate(([pl, sb]) => {
    for (const d of document.querySelectorAll(".prop-ctl")) {
      const h = d.querySelector(":scope > .prop-ctl-h > span");
      if (h && h.textContent.trim() === pl) {
        for (const s of d.querySelectorAll(".prop-sub")) {
          const sp = s.querySelector(".prop-ctl-h > span");
          if (sp && sp.textContent.trim() === sb) return s.querySelector(".prop-ctl-h > b")?.textContent.trim() ?? null;
        }
      }
    }
    return null;
  }, [plain, sub]);
}

// ================= A2-perbaikan: skor papan via Terapkan =================
console.log("\n== A2-perbaikan: skor papan (template-code) ==");
await openTemplate("#template-code", "Adu Kode");
await clickTab("Objek");
await pickObj("Papan skor");
const vAwal = await scoreVal("Angka akhir oranye", "Performa");
ok("A2f nilai awal Performa (akhir oranye) = 88", vAwal === "88", "dapat " + vAwal);
await pauseSeek(25); await page.waitForTimeout(500);
const sBefore = await stageShot("code-skor2-before");
await page.locator('input[type="range"][aria-label="Angka akhir oranye — Performa"]').fill("50");
await page.waitForTimeout(1200);
const vSesudahFill = await scoreVal("Angka akhir oranye", "Performa");
ok("A2g nilai tampil 50 sesudah geser (draft)", vSesudahFill === "50", "dapat " + vSesudahFill);
const srcSesudahFill = await srcdoc();
ok("A2h TIDAK ada pratinjau langsung untuk slider skor (srcdoc belum berubah)", !/96,\s*94,\s*50/.test(srcSesudahFill), "sesuai kode: applyArrayValue tanpa scheduleLive");
await pauseSeek(25); await page.waitForTimeout(500);
const sMid = await stageShot("code-skor2-mid");
const dMid = pixelDiff(sBefore.buf, sMid.buf);
ok("A2i preview TIDAK berubah sesudah geser skor (tanpa Terapkan)", dMid.changed === 0, `${dMid.changed} px`);
// sekarang Terapkan
await page.locator("#apply-objek").click();
await page.waitForTimeout(1500);
const srcSesudahApply = await srcdoc();
const diffS = srcdocDiff(srcSesudahFill, srcSesudahApply);
ok("A2j srcdoc mengandung [96,94,50] sesudah Terapkan", /96,\s*94,\s*50/.test(srcSesudahApply), "hunk: " + diffS.after.slice(0, 160));
await pauseSeek(25); await page.waitForTimeout(500);
const sAfter = await stageShot("code-skor2-after");
const dS = pixelDiff(sBefore.buf, sAfter.buf);
ok("A2k preview BERUBAH sesudah Terapkan (papan t=25)", dS.changed > 50, `${dS.changed} px (${dS.pct}%), box ${dS.box}`);

// ================= A3-perbaikan: label nilai beat =================
console.log("\n== A3-perbaikan: label nilai beat (template-sleep) ==");
await openTemplate("#template-sleep", "Tidur");
await clickTab("Objek");
await pickObj("Jalan cerita");
await page.locator('input[type="range"][aria-label="Waktu tidur lagi"]').fill("26");
await page.waitForTimeout(1200);
const beatShown = await page.evaluate(() => {
  for (const d of document.querySelectorAll(".prop-ctl")) {
    const s = d.querySelector(".prop-ctl-h > span");
    if (s && s.textContent.trim() === "Waktu tidur lagi") return d.querySelector(".prop-ctl-h > b")?.textContent.trim() ?? null;
  }
  return null;
});
ok("A3d nilai beat tampil '26.00 detik' (satuan detik, 2 desimal)", beatShown === "26.00 detik", "dapat " + beatShown);

// ================= A6/A7-direct: template rusak di studio -> bukti via file langsung =================
// (Sweep membuktikan Kuota + Perang TIDAK bisa dibuka di studio sama sekali;
//  jadi benteng + tangki dibuktikan lewat file hasil CLI + render langsung.)
console.log("\n== A6/A7-direct: render file langsung (port 8321) ==");
async function renderDirect(url, t, name) {
  const p2 = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = [];
  p2.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)));
  p2.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await routeVendor(p2);
  await p2.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p2.waitForTimeout(4000);
  const info = await p2.evaluate((tt) => {
    const go = document.getElementById("go"), gui = document.getElementById("gui");
    if (go) go.style.display = "none"; if (gui) gui.style.display = "none";
    try { window.renderAt(tt); return { ok: true }; } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
  }, t);
  await p2.waitForTimeout(600);
  let buf = null;
  try { buf = await p2.locator("canvas").first().screenshot({ path: `${OUT}/props-all-${name}.png` }); } catch (e) { /* tanpa canvas */ }
  await p2.close();
  return { info, errs, buf };
}
const rOrigPerang = await renderDirect("http://localhost:8321/orig-perang.html", 15, "direct-perang-orig-t15");
ok("A6d template perang ASLI render langsung tanpa error", rOrigPerang.errs.length === 0 && rOrigPerang.info.ok, rOrigPerang.errs.join(" | ") || "renderAt ok");
const rFort = await renderDirect("http://localhost:8321/perang-fort.html", 15, "direct-perang-fort13-t15");
ok("A6e perang + fort.size=1.3 (CLI) render tanpa error", rFort.errs.length === 0 && rFort.info.ok, rFort.errs.join(" | ") || "renderAt ok");
if (rOrigPerang.buf && rFort.buf) {
  const dF = pixelDiff(rOrigPerang.buf, rFort.buf);
  ok("A6f benteng 1.3 vs asli BERUBAH (piksel, t=15)", dF.changed > 50, `${dF.changed} px (${dF.pct}%), box ${dF.box}`);
} else ok("A6f benteng 1.3 vs asli BERUBAH (piksel, t=15)", false, "screenshot canvas gagal");
const rBeat = await renderDirect("http://localhost:8321/perang-beat.html", 15, "direct-perang-beat135-t15");
ok("A6g perang + beat.war=13.5 (CLI) JUGA error TDZ saat render langsung", rBeat.errs.some((e) => e.includes("T_WAR")), rBeat.errs.join(" | ") || "tidak error?!");
const rOrigKuota = await renderDirect("http://localhost:8321/orig-kuota.html", 6, "direct-kuota-orig-t6");
ok("A7f template kuota ASLI render langsung tanpa error", rOrigKuota.errs.length === 0 && rOrigKuota.info.ok, rOrigKuota.errs.join(" | ") || "renderAt ok");
const rTank = await renderDirect("http://localhost:8321/kuota-tank30.html", 6, "direct-kuota-tank30-t6");
ok("A7g kuota + tank.curve baris3=30 (CLI) render tanpa error", rTank.errs.length === 0 && rTank.info.ok, rTank.errs.join(" | ") || "renderAt ok");
if (rOrigKuota.buf && rTank.buf) {
  const dT = pixelDiff(rOrigKuota.buf, rTank.buf);
  ok("A7h tangki 30 vs 92 BERUBAH (piksel, t=6)", dT.changed > 50, `${dT.changed} px (${dT.pct}%), box ${dT.box}`);
} else ok("A7h tangki 30 vs 92 BERUBAH (piksel, t=6)", false, "screenshot canvas gagal");

// ================= BAGIAN B: ketuk + fokus + nol-teknis (1366) =================
console.log("\n== BAGIAN B: ketuk, fokus, nol-teknis (1366) ==");
await openTemplate("#template", "Versus");
await clickTab("Objek");
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
await clickTab("Objek"); await bannedSweep("1366 tab Objek");
await clickTab("Teks"); await bannedSweep("1366 tab Teks");
await clickTab("Shot"); await bannedSweep("1366 tab Shot");
await clickTab("Caption"); await bannedSweep("1366 tab Caption");
await page.locator("#expBtn").click(); await page.waitForTimeout(400);
const expOpen = await page.evaluate(() => !!document.querySelector("#expH"));
ok("B7 dialog Ekspor terbuka", expOpen, "");
if (expOpen) {
  await bannedSweep("1366 dialog Ekspor");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
}
await page.locator("#keysBtn").click(); await page.waitForTimeout(300);
await bannedSweep("1366 dialog Pintasan");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
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
const srcC0 = await srcdoc();
await page.locator('input[type="range"][aria-label="Geser kiri-kanan"]').fill("-0.7");
await page.waitForTimeout(1500);
const srcC1 = await srcdoc();
const shownC = await page.evaluate(() => {
  for (const d of document.querySelectorAll(".prop-ctl")) {
    const s = d.querySelector(".prop-ctl-h > span");
    if (s && s.textContent.trim() === "Geser kiri-kanan") return d.querySelector(".prop-ctl-h > b")?.textContent.trim() ?? null;
  }
  return null;
});
ok("C2a slider 390: nilai tampil -0.70", shownC === "-0.70", "dapat " + shownC);
ok("C2b slider 390: srcdoc MX0=-0.7", /MX0\s*=\s*-0\.7/.test(srcC1), "");
await pauseSeek(5); await page.waitForTimeout(500);
const cAfter = await stageShot("390-typing-x-after");
const dc = pixelDiff(cBefore.buf, cAfter.buf);
ok("C2c slider 390: preview BERUBAH", dc.changed > 20, `${dc.changed} px (${dc.pct}%)`);
// ketuk preview 390 (Versus)
await openTemplate("#template", "Versus");
await clickTab("Objek");
async function tapPreview390(fx, fy) {
  await pauseSeek(0); await page.waitForTimeout(400);
  const box = await page.locator("#stage").boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(500);
  return (await page.textContent(".obj-now")) || "";
}
const cT1 = await tapPreview390(0.25, 0.6);
ok("C3a ketuk 390 kiri → Maskot oranye", cT1.includes("Maskot oranye"), cT1.trim().slice(0, 60));
const cT2 = await tapPreview390(0.75, 0.6);
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
await openTemplate("#template-code", "Adu Kode");
await clickTab("Caption");
const capInput = page.locator('input[aria-label="Teks caption 1"]');
const CAP_BARU = "Verifikasi caption 23:26";
await capInput.fill(CAP_BARU);
await page.locator("#apply-cap").click();
await page.waitForTimeout(1200);
const srcAfterCap = await srcdoc();
ok("D1a caption baru masuk srcdoc sesudah Terapkan", srcAfterCap.includes(CAP_BARU), "");
await pauseSeek(4); await page.waitForTimeout(600);
const subText = await stEval((w) => { const el = w.document.querySelector("#sub") || w.document.querySelector("#cap"); return el ? el.textContent : "(tidak ada #sub/#cap)"; });
ok("D1b caption baru tampil di preview (t=4)", String(subText).includes("Verifikasi caption"), "sub: " + String(subText).slice(0, 80));
await page.locator("#stage").screenshot({ path: `${OUT}/props-all-caption-applied.png` });
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
ok("D2 shot 2 mulai berubah di srcdoc", diffShot.before !== diffShot.after, `baru=${shot2Baru} sesudah: ` + diffShot.after.slice(0, 160));
await page.locator("button:has-text('+ Simpan')").first().click().catch(() => {});
await page.waitForTimeout(400);
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
console.log("\n== console/page errors (bagian 2): " + errors.length + " ==");
errors.slice(0, 10).forEach((e) => console.log("  ERR: " + e));
ok("E1 nol console/page error di semua lebar yang diuji (bagian 2)", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "");
await writeFile(`${OUT}/props-all-verify-headless-2.json`, JSON.stringify({ results, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `\nGAGAL: ${bad.length} dari ${results.length}` : `\nSEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
