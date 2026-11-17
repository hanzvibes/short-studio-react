#!/usr/bin/env node
// Verifikasi ulang #2 — regresi singkat + idempotensi studio:
// A) Caption -> Terapkan -> terlihat (caps()[0] + now-cap).
// B) Simpan sebagai video baru -> reload -> bertahan.
// C) Idempotensi studio: Perang beat.war digeser -> Terapkan -> Simpan ->
//    reload -> buka entri mine -> srcdoc tepat 1x `const T_WAR=` + Preview
//    siap; geser beat lagi -> Terapkan -> tetap 1x deklarasi, 0 error.
//   node verification/verify2-regress.mjs
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
const st = (label) => page.evaluate(() => document.body.textContent?.includes("Preview siap"));
const caps0 = () => page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.caps()?.[0]?.[2] ?? null);
const countDecl = (name) => page.evaluate((n) => {
  const sd = document.querySelector("#pv")?.srcdoc || "";
  return (sd.match(new RegExp("const " + n + "=", "g")) || []).length;
}, name);
const waitReady = () => page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });

// ---------- A+B) Caption + simpan (template-code) ----------
await page.goto("http://localhost:3000/#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await waitReady();
await page.click(".tour-skip").catch(() => {});
await page.click('button[role="tab"]:has-text("Caption")');
await page.waitForTimeout(400);
await page.fill(".edit-cap .cap-text >> nth=0", "VERIF2 CAPTION");
await page.click("#apply-cap");
await waitReady();
await page.waitForTimeout(2000);
const gotCap = await caps0();
console.log(`A caption sesudah Terapkan: caps()[0]=${JSON.stringify(gotCap)} (harap "VERIF2 CAPTION")`);
const nowCap = await page.evaluate(() => document.querySelector(".now-cap")?.textContent ?? null);
console.log(`A bilah now-cap: ${JSON.stringify(nowCap)}`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-caption-after.png" });
// Simpan sebagai video baru
await page.click('button[title="Simpan video saat ini sebagai video baru"]');
await page.waitForTimeout(400);
await page.fill("dialog input >> nth=0", "Video Verif2 Caption");
await page.click('button:has-text("Simpan video")');
await page.waitForTimeout(800);
const mineBefore = await page.locator(".mine-item").count();
console.log(`B mine-item sesudah simpan: ${mineBefore}`);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const mineAfter = await page.locator(".mine-item").count();
console.log(`B mine-item sesudah reload: ${mineAfter} (harap >=1)`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-mine-after-reload.png" });

// ---------- C) Idempotensi studio: beat.war Perang ----------
await page.goto("http://localhost:3000/#template-perang", { waitUntil: "domcontentloaded", timeout: 60000 });
await waitReady();
await page.click(".tour-skip").catch(() => {});
await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
  await page.locator("button", { hasText: "Objek" }).first().click();
});
await page.waitForTimeout(800);
const objs = await page.locator("button.obj-pick-item").allTextContents();
console.log(`C objek Perang: ${objs.join(" | ")}`);
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click().catch(async () => {
  await page.locator("button.obj-pick-item").last().click();
});
await page.waitForTimeout(800);
const beatSlider = page.locator('.prop-row:has-text("Waktu perang mulai") input[type="range"]');
await beatSlider.waitFor({ timeout: 15000 });
console.log(`C beat.war awal=${await beatSlider.inputValue()}`);
await beatSlider.evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, "13.5");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(600);
console.log(`C beat.war sesudah geser=${await beatSlider.inputValue()}; decl T_WAR SEBELUM Terapkan=${await countDecl("T_WAR")}`);
await page.locator("#apply-objek").click();
await waitReady();
await page.waitForTimeout(1500);
console.log(`C sesudah Terapkan: decl T_WAR=${await countDecl("T_WAR")} (harap 1); Preview siap=${await st()}`);
// Simpan sebagai video baru
await page.click('button[title="Simpan video saat ini sebagai video baru"]');
await page.waitForTimeout(400);
await page.fill("dialog input >> nth=0", "Video Verif2 Perang Beat");
await page.click('button:has-text("Simpan video")');
await page.waitForTimeout(800);
console.log(`C mine-item sesudah simpan perang: ${await page.locator(".mine-item").count()}`);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
// Buka entri mine Perang (item terakhir / yang berjudul itu)
const mineTitles = await page.locator(".mine-item").allTextContents();
console.log(`C mine sesudah reload: ${mineTitles.map((t) => JSON.stringify(t.slice(0, 40))).join(" | ")}`);
await page.locator(".mine-item", { hasText: "Video Verif2 Perang Beat" }).first().click();
await waitReady();
await page.waitForTimeout(2000);
console.log(`C buka entri mine: decl T_WAR=${await countDecl("T_WAR")} (harap 1); Preview siap=${await st()}; errs=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
// Geser beat lagi di entri mine, Terapkan, cek tetap 1 deklarasi
await page.getByRole("button", { name: "Objek" }).click().catch(async () => {
  await page.locator("button", { hasText: "Objek" }).first().click();
});
await page.waitForTimeout(800);
await page.locator("button.obj-pick-item", { hasText: "Jalan cerita" }).first().click().catch(() => {});
await page.waitForTimeout(800);
const beat2 = page.locator('.prop-row:has-text("Waktu perang mulai") input[type="range"]');
await beat2.waitFor({ timeout: 15000 });
console.log(`C beat.war di entri mine awal=${await beat2.inputValue()}`);
await beat2.evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, "14");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(600);
await page.locator("#apply-objek").click();
await waitReady();
await page.waitForTimeout(1500);
console.log(`C sesudah geser ulang + Terapkan di entri mine: decl T_WAR=${await countDecl("T_WAR")} (harap 1); Preview siap=${await st()}; total errs=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
await page.screenshot({ path: "/home/hatch/workspace/short-studio-react/verification/verify2-perang-mine.png" });
await browser.close();
console.log("REGRESI SELESAI");
