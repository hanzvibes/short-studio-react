#!/usr/bin/env node
// Verifikasi ulang #2 — lanjutan regresi (perbaikan skrip uji saya:
// selektor slider adalah aria-label, bukan .prop-row):
// A2) now-cap menampilkan caption baru pada waktunya.
// C) Idempotensi studio beat.war Perang (ulang penuh).
//   node verification/verify2-regress2.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const waitReady = () => page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
const countDecl = (name) => page.evaluate((n) => {
  const sd = document.querySelector("#pv")?.srcdoc || "";
  return (sd.match(new RegExp("const " + n + "=", "g")) || []).length;
}, name);
async function setRange(label, value) {
  const s = page.locator(`input[type="range"][aria-label="${label}"]`);
  await s.waitFor({ timeout: 15000 });
  const v0 = await s.inputValue();
  await s.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  return v0;
}
async function openObjek() {
  await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
    await page.locator("button", { hasText: "Objek" }).first().click();
  });
  await page.waitForTimeout(800);
}
async function saveMine(name) {
  await page.click('button[title="Simpan video saat ini sebagai video baru"]');
  await page.waitForTimeout(400);
  await page.fill("dialog input >> nth=0", name);
  await page.click('button:has-text("Simpan video")');
  await page.waitForTimeout(800);
  return await page.locator(".mine-item").count();
}

// ---------- A2) now-cap ----------
await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await waitReady();
await page.click(".tour-skip").catch(() => {});
await page.click('button[role="tab"]:has-text("Caption")');
await page.waitForTimeout(400);
await page.fill(".edit-cap .cap-text >> nth=0", "VERIF2 CAPTION");
await page.click("#apply-cap");
await waitReady();
await page.waitForTimeout(2000);
const t0 = await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.caps()?.[0]?.[0]);
await page.evaluate((t) => { try { document.querySelector("#pv").contentWindow.__st.seek(t + 0.5); } catch {} }, t0);
await page.waitForTimeout(1500);
const nowCap = await page.evaluate(() => document.querySelector(".now-cap")?.textContent ?? null);
console.log(`A2 caps[0] mulai t=${t0}; now-cap pada t+0.5: ${JSON.stringify(nowCap)} (harap memuat "VERIF2 CAPTION")`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-caption-nowcap.png" });

// ---------- C) Idempotensi studio beat.war ----------
// Catatan: hash hanya dibaca saat mount awal (tidak ada listener
// hashchange), jadi pindah template lewat goto hash-only TIDAK ganti
// template — harus reload agar hash baru dibaca.
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await waitReady();
await page.click(".tour-skip").catch(() => {});
await openObjek();
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click();
await page.waitForTimeout(800);
const w0 = await setRange("Waktu perang mulai", 13.5);
console.log(`C beat.war awal=${w0} -> 13.5; nilai tampil=${await page.locator('input[type="range"][aria-label="Waktu perang mulai"]').inputValue()}`);
await page.waitForTimeout(600);
console.log(`C decl T_WAR SEBELUM Terapkan=${await countDecl("T_WAR")}`);
await page.locator("#apply-objek").click();
await waitReady();
await page.waitForTimeout(1500);
const sdHas = await page.evaluate(() => (document.querySelector("#pv")?.srcdoc || "").includes("const T_WAR=13.5;"));
console.log(`C sesudah Terapkan: decl T_WAR=${await countDecl("T_WAR")} (harap 1); srcdoc memuat const T_WAR=13.5;=${sdHas}; Preview siap=${await page.evaluate(() => document.body.textContent?.includes("Preview siap"))}`);
const mineN = await saveMine("Video Verif2 Perang Beat");
console.log(`C mine-item sesudah simpan perang: ${mineN}`);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log(`C mine sesudah reload: ${await page.locator(".mine-item").count()}`);
await page.locator(".mine-item", { hasText: "Video Verif2 Perang Beat" }).first().click();
await waitReady();
await page.waitForTimeout(2000);
console.log(`C buka entri mine: decl T_WAR=${await countDecl("T_WAR")} (harap 1); Preview siap=${await page.evaluate(() => document.body.textContent?.includes("Preview siap"))}; errs=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
await openObjek();
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click();
await page.waitForTimeout(800);
const w1 = await setRange("Waktu perang mulai", 14);
console.log(`C beat.war di entri mine awal=${w1} -> 14`);
await page.waitForTimeout(600);
await page.locator("#apply-objek").click();
await waitReady();
await page.waitForTimeout(1500);
const sdHas2 = await page.evaluate(() => (document.querySelector("#pv")?.srcdoc || "").includes("const T_WAR=14;"));
console.log(`C sesudah geser ulang + Terapkan di entri mine: decl T_WAR=${await countDecl("T_WAR")} (harap 1); srcdoc memuat const T_WAR=14;=${sdHas2}; Preview siap=${await page.evaluate(() => document.body.textContent?.includes("Preview siap"))}; total errs=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-perang-mine.png" });
await browser.close();
console.log("REGRESI-2 SELESAI");
