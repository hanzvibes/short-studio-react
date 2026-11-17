#!/usr/bin/env node
// Smoke test bottom sheet (portrait 390px) + regresi desktop 1440px.
// Usage: npm start (di terminal lain) lalu: node verification/sheet-smoke.mjs
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const outdir = process.argv[2] || "verification";
const VENDOR = process.env.VENDOR_DIR || "/tmp/ss-vendor";
await mkdir(outdir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});

async function armRoutes(page) {
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
  });
  await page.route("https://fonts.googleapis.com/**", async (r) =>
    r.fulfill({ contentType: "text/css", body: "/* font fallback sistem */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
}

const geom = () => {
  const q = (s) => document.querySelector(s);
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const app = q(".app");
  const insp = q(".inspector");
  const cs = insp ? getComputedStyle(insp) : null;
  return {
    appClass: app?.className,
    sheetMode: app?.classList.contains("sheet-mode"),
    inspector: r(insp),
    inspectorPosition: cs?.position,
    inspectorTransform: cs?.transform,
    stage: r(q("#stage")),
    transport: r(q(".transport")),
    timeline: r(q("#timelinePanel")),
    timelineCollapsed: q("#timelinePanel")?.classList.contains("tl-collapsed"),
    foldBtn: q(".tl-fold")?.textContent?.trim(),
    sheetTitle: q(".sheet-title")?.textContent?.trim(),
    handle: r(q(".sheet-handle")),
    fab: r(q(".sheet-fab")),
    workspaceScrollH: q("#workspace")?.scrollHeight,
    workspaceClientH: q("#workspace")?.clientHeight,
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    coarse: window.matchMedia("(pointer:coarse)").matches,
    status: q(".statusbar .st-left")?.textContent?.trim(),
  };
};

const result = {};
// ---------- 390x844 portrait, touch ----------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => errors.push("reqfail: " + r.url().slice(0, 120) + " :: " + (r.failure()?.errorText || "?")));
  await armRoutes(page);
  // Matikan tur otomatis (localStorage baru): tur langkah 0 membuka drawer
  // dan — sesuai desain — menutup sheet, jadi tanpa ini peek tidak teruji.
  await page.addInitScript(() => { try { localStorage.setItem("ss.tour", "1"); } catch {} });
  await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
  try {
    await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  } catch { console.log("TIMEOUT Preview siap; status:", await page.textContent(".statusbar .st-left").catch(() => "?")); }
  await page.waitForTimeout(5000);
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(800);
  result.peek = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-390-peek.png` });

  // Chevron: peek -> closed? (satu langkah ke bawah: peek -> closed)
  await page.click(".sheet-chev");
  await page.waitForTimeout(600);
  result.afterChevron = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-390-closed.png` });
  // FAB -> peek
  await page.click(".sheet-fab");
  await page.waitForTimeout(600);
  result.afterFab = await page.evaluate(geom);
  // Ketuk header -> half
  await page.click(".sheet-head .sheet-title");
  await page.waitForTimeout(600);
  result.afterHeadTap = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-390-half.png` });
  // Di Half, strip timeline tertutup sheet (by design) — kembali ke Peek
  // dulu supaya tombol lipatan bisa diketuk.
  await page.click(".sheet-head .sheet-title");
  await page.waitForTimeout(600);
  result.backToPeek = await page.evaluate(geom);
  // Buka lipatan timeline
  await page.click(".tl-fold");
  await page.waitForTimeout(600);
  result.afterTlOpen = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-390-tlopen.png` });
  // Lipat lagi
  await page.click(".tl-fold");
  await page.waitForTimeout(600);
  result.afterTlClose = await page.evaluate(geom);
  // Drag gagang ke atas (mouse; pointer events) dari peek -> harus naik snap
  const handle = await page.evaluate(() => { const b = document.querySelector(".sheet-handle").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y - 260, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  result.afterDragUp = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-390-drag.png` });
  // Esc: step down
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  result.afterEsc = await page.evaluate(geom);
  // Tab Objek: judul sheet berubah
  await page.evaluate(() => { document.querySelectorAll(".tab")[3].click(); });
  await page.waitForTimeout(500);
  result.objekTab = await page.evaluate(geom);
  // Terapkan di header: disabled saat tidak ada perubahan
  result.headerApplyDisabled = await page.evaluate(() => document.querySelector(".sheet-apply")?.disabled);
  result.errors390 = errors.slice(0, 10);
  await page.close();
}
// ---------- 1440x900 desktop regresi ----------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  await armRoutes(page);
  await page.addInitScript(() => { try { localStorage.setItem("ss.tour", "1"); } catch {} });
  await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
  try {
    await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
  } catch { console.log("TIMEOUT desktop Preview siap"); }
  await page.waitForTimeout(4000);
  await page.click(".tour-skip").catch(() => {});
  await page.waitForTimeout(500);
  result.desktop = await page.evaluate(geom);
  await page.screenshot({ path: `${outdir}/sheet-impl-1440-desktop.png` });
  result.errorsDesktop = errors.slice(0, 10);
  await page.close();
}
console.log(JSON.stringify(result, null, 2));
await writeFile(`${outdir}/sheet-impl-smoke.json`, JSON.stringify(result, null, 2));
await browser.close();
