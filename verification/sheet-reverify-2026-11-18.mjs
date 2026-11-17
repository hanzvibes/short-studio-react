#!/usr/bin/env node
// Verifikasi ulang F1 (independen, ditulis dari nol): tur langkah 3 di mode
// sheet 390px — klik Lanjut 3x, ArrowRight 3x, masuk-ulang — plus regresi
// geometri sheet Peek/Half, satu alur edit di sheet, dan desktop 1440.
// Server: next start :3000 (build produksi). Profil fresh per varian.
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const BASE = "http://localhost:3000/#template-code";
const OUT = new URL("./", import.meta.url).pathname;
const results = { build: "HIJAU (dijalankan terpisah, route / 49.6 kB / First Load 152 kB)", variants: {}, regression: {}, errors: {} };

const browser = await chromium.launch({
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});

async function armRoutes(page) {
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile("/tmp/ss-vendor/three.min.js") }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`/tmp/ss-vendor/${rel}`) });
  });
  await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
}

function rect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const insp = document.querySelector(".inspector");
    const stepM = document.querySelector(".tour-card")?.textContent.match(/(\d)\s*\/\s*5/);
    return {
      step: stepM ? Number(stepM[1]) : null,
      spot: r(".tour-spot"),
      inspector: r(".inspector"),
      stage: r("#stage"),
      sheetClass: insp ? insp.className : null,
      sheetSnap: insp ? (insp.className.match(/sheet-(peek|half|full|closed)/)?.[1] ?? "n/a") : null,
    };
  });
}

// Sorotan benar bila menutupi bagian kelihatan inspector (dijepit viewport):
// spot.y <= insp.y+8 dan spot bawah >= min(insp bawah, vh-8)-8.
function coversVisible(spot, insp, vh) {
  if (!spot || !insp) return false;
  const visBottom = Math.min(insp.y + insp.h, vh - 8);
  return spot.y <= insp.y + 8 && spot.y + spot.h >= visBottom - 8 && spot.x <= insp.x + 8 && spot.x + spot.w >= insp.x + insp.w - 8;
}

async function newPage(vp) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: vp.width <= 900, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await armRoutes(page);
  return { ctx, page, errs };
}

async function openTour(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".tour-card", { timeout: 40000 });
  await page.waitForTimeout(1200);
}

async function sampleSpot(page, ms, every = 400) {
  const traj = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await snapshot(page);
    traj.push({ t: Date.now() - t0, step: s.step, spot: s.spot, insp: s.inspector, snap: s.sheetSnap });
    await page.waitForTimeout(every);
  }
  return traj;
}

// ---------- Varian A: klik Lanjut 3x ----------
{
  const { ctx, page, errs } = await newPage({ width: 390, height: 844 });
  await openTour(page);
  for (let i = 0; i < 3; i++) {
    await page.locator(".tour-card .btn.primary").click();
    await page.waitForTimeout(400);
  }
  const traj = await sampleSpot(page, 6000);
  const fin = traj[traj.length - 1];
  await page.screenshot({ path: OUT + "sheet-tour3-reverify-390-click.png" });
  const ok = coversVisible(fin.spot, fin.insp, 844);
  const expectY = fin.insp ? fin.insp.y - 6 : null;
  results.variants.click = { final: fin, trajectory: traj.map((t) => ({ t: t.t, spot: t.spot, snap: t.snap })), coversVisibleInspector: ok, expectedY: expectY, errors: errs };
  console.log("CLICK final:", JSON.stringify(fin), "coversVisible:", ok, "errors:", errs.length);
  await ctx.close();
}

// ---------- Varian B: ArrowRight 3x ----------
{
  const { ctx, page, errs } = await newPage({ width: 390, height: 844 });
  await openTour(page);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
  }
  const traj = await sampleSpot(page, 6000);
  const fin = traj[traj.length - 1];
  await page.screenshot({ path: OUT + "sheet-tour3-reverify-390-keys.png" });
  const ok = coversVisible(fin.spot, fin.insp, 844);
  results.variants.keys = { final: fin, trajectory: traj.map((t) => ({ t: t.t, spot: t.spot, snap: t.snap })), coversVisibleInspector: ok, errors: errs };
  console.log("KEYS final:", JSON.stringify(fin), "coversVisible:", ok, "errors:", errs.length);
  await ctx.close();
}

// ---------- Varian C: masuk-ulang (Kembali -> Lanjut) ----------
{
  const { ctx, page, errs } = await newPage({ width: 390, height: 844 });
  await openTour(page);
  for (let i = 0; i < 3; i++) {
    await page.locator(".tour-card .btn.primary").click();
    await page.waitForTimeout(400);
  }
  await sampleSpot(page, 4000); // biarkan settle dulu
  await page.locator(".tour-card .btn.ghost.small").click(); // Kembali -> langkah 2
  await page.waitForTimeout(800);
  const back = await snapshot(page);
  await page.locator(".tour-card .btn.primary").click(); // Lanjut -> langkah 3 lagi
  await page.waitForTimeout(400);
  const traj = await sampleSpot(page, 3000);
  const fin = traj[traj.length - 1];
  await page.screenshot({ path: OUT + "sheet-tour3-reverify-390-reentry.png" });
  const ok = coversVisible(fin.spot, fin.insp, 844);
  results.variants.reentry = { afterBack: back, final: fin, trajectory: traj.map((t) => ({ t: t.t, spot: t.spot, snap: t.snap })), coversVisibleInspector: ok, errors: errs };
  console.log("REENTRY afterBack step:", back.step, "final:", JSON.stringify(fin), "coversVisible:", ok, "errors:", errs.length);
  await ctx.close();
}

// ---------- Regresi: geometri sheet Peek/Half + alur edit di sheet (390px) ----------
{
  const { ctx, page, errs } = await newPage({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".tour-card", { timeout: 40000 });
  await page.locator(".tour-skip").click(); // Lewati tur
  await page.waitForTimeout(1200);
  // Tur langkah 0 menutup sheet (closeSheet): bila masih closed, buka via FAB.
  let s0 = await snapshot(page);
  if (s0.sheetSnap === "closed") {
    await page.locator(".sheet-fab").click();
    await page.waitForTimeout(1000);
  }
  const peek = await snapshot(page);
  // Drag handle ke atas -> Half (coba 2x bila snap pertama gagal)
  async function dragToHalf() {
    const handle = await page.locator(".sheet-handle").boundingBox();
    if (!handle) return false;
    const cx = handle.x + handle.width / 2, cy = handle.y + handle.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(cx, cy - i * 25, { steps: 2 }); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForTimeout(1200);
    return (await snapshot(page)).sheetSnap === "half";
  }
  let half = await snapshot(page);
  if (half.sheetSnap !== "half") {
    await dragToHalf();
    half = await snapshot(page);
    if (half.sheetSnap !== "half") { await dragToHalf(); half = await snapshot(page); }
  }
  await page.screenshot({ path: OUT + "sheet-geometry-reverify-390.png" });
  results.regression.sheetGeometry390 = { peek: { stage: peek.stage, snap: peek.sheetSnap, inspector: peek.inspector }, half: half ? { stage: half.stage, snap: half.sheetSnap, inspector: half.inspector } : null };
  console.log("GEOMETRY peek stage:", JSON.stringify(peek.stage), "snap:", peek.sheetSnap, "| half stage:", JSON.stringify(half?.stage), "snap:", half?.sheetSnap);

  // Alur edit: tab Teks -> ubah Judul -> Terapkan (sheet-apply) -> preview berubah
  try {
  await page.locator('.tabs .tab:has-text("Teks")').click();
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => {
    const f = document.querySelector("#stage iframe");
    return { srcdocHasTitle: !!f?.srcdoc, bodyText: f?.contentDocument?.body?.innerText?.slice(0, 400) ?? null };
  });
  const origTitle = await page.locator("#fTitle").inputValue();
  const NEW_TITLE = "JUDUL REVERIFY 7X9";
  await page.locator("#fTitle").fill(NEW_TITLE);
  await page.waitForTimeout(300);
  const applyDisabled = await page.locator(".sheet-apply").isDisabled();
  await page.locator(".sheet-apply").click();
  await page.waitForTimeout(1800);
  const after = await page.evaluate((nt) => {
    const f = document.querySelector("#stage iframe");
    const txt = f?.contentDocument?.body?.innerText ?? "";
    return { srcdocHasNew: (f?.srcdoc ?? "").includes(nt), bodyHasNew: txt.includes(nt), bodySnippet: txt.slice(0, 200) };
  }, NEW_TITLE);
  await page.screenshot({ path: OUT + "sheet-edit-reverify-390.png" });
  results.regression.editFlow390 = { origTitle, newTitle: NEW_TITLE, applyWasDisabled: applyDisabled, beforeHasTitleField: before.srcdocHasTitle, after, errors: errs };
  console.log("EDIT orig:", JSON.stringify(origTitle), "applyDisabled:", applyDisabled, "after:", JSON.stringify(after), "errors:", errs.length);
  } catch (e) {
    results.regression.editFlow390 = { error: String(e).slice(0, 500), errors: errs };
    console.log("EDIT FAILED:", String(e).slice(0, 300));
    await page.screenshot({ path: OUT + "sheet-edit-reverify-390.png" }).catch(() => {});
  }
  await ctx.close();
}

// ---------- Desktop 1440: tur langkah 3 + stage ----------
{
  const { ctx, page, errs } = await newPage({ width: 1440, height: 900 });
  await openTour(page);
  for (let i = 0; i < 3; i++) {
    await page.locator(".tour-card .btn.primary").click();
    await page.waitForTimeout(400);
  }
  const traj = await sampleSpot(page, 4000);
  const fin = traj[traj.length - 1];
  await page.screenshot({ path: OUT + "sheet-tour3-reverify-1440.png" });
  const ok = coversVisible(fin.spot, fin.insp, 900);
  results.regression.desktop1440 = { final: fin, coversInspector: ok, errors: errs };
  console.log("DESKTOP1440 final:", JSON.stringify(fin), "covers:", ok, "errors:", errs.length);
  await ctx.close();
}

await browser.close();
await writeFile(OUT + "sheet-tour3-reverify-2026-11-18.json", JSON.stringify(results, null, 2));
console.log("DONE");
