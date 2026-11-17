#!/usr/bin/env node
// Verifikasi INDEPENDEN bagian 3: sweep nol-teknis 390px + regresi D1/D2/D3 + E1.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const OUT = "/home/hatch/workspace/short-studio-react/verification";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
await mkdir(OUT, { recursive: true });
const results = [];
const errors = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra: String(extra).slice(0, 400) }); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 200) : ""}`); };
function srcdocDiff(before, after) {
  let i = 0; while (i < Math.min(before.length, after.length) && before[i] === after[i]) i++;
  let j = 0; while (j < Math.min(before.length - i, after.length - i) && before[before.length - 1 - j] === after[after.length - 1 - j]) j++;
  return { before: before.slice(Math.max(0, i - 60), before.length - j + 60).replace(/\s+/g, " ").slice(0, 300), after: after.slice(Math.max(0, i - 60), after.length - j + 60).replace(/\s+/g, " ").slice(0, 300) };
}
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) => r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => { const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", ""); return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) }); });
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
  return page.evaluate(([fnStr, ...a]) => { const pv = document.querySelector("#pv"); const w = pv?.contentWindow; const f = eval(`(${fnStr})`); return f(w, ...a); }, [fn.toString(), ...args]);
}
const pauseSeek = (t) => stEval((w, tt) => { try { w.__st.pause(); w.__st.seek(tt); return true; } catch (e) { return String(e); } }, t);
const srcdoc = () => page.evaluate(() => document.querySelector("#pv")?.srcdoc || "");
async function clickTab(name) { await page.locator('[role="tab"]', { hasText: new RegExp(`^${name}`) }).first().click(); await page.waitForTimeout(400); }
const BANNED = ["claude.x", "gs[0]", "lookAt", "caps", "VO", "LEN", "T_BOARD", "envelope", "sinus", "literal", "srcdoc", "props"];
async function bannedSweep(scope) {
  const text = await page.evaluate(() => document.body.innerText);
  const found = BANNED.filter((s) => text.includes(s));
  ok(`NOL-teknis [${scope}]`, found.length === 0, found.length ? "LOLOS: " + found.join(", ") : "bersih");
  return found;
}
console.log("\n== 390px: nol-teknis semua tab ==");
await openTemplate("#template-typing", "Mengetik");
await clickTab("Teks"); await bannedSweep("390 tab Teks");
await clickTab("Shot"); await bannedSweep("390 tab Shot");
await clickTab("Caption"); await bannedSweep("390 tab Caption");
await clickTab("Objek"); await bannedSweep("390 tab Objek");
// dialog Simpan (tanpa menyimpan)
await page.locator("button:has-text('+ Simpan')").first().click().catch(() => {});
await page.waitForTimeout(400);
const saveOpen = await page.evaluate(() => !!document.querySelector("#mineH"));
ok("D0 dialog Simpan terbuka (390)", saveOpen, "");
if (saveOpen) { await bannedSweep("390 dialog Simpan"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }

console.log("\n== BAGIAN D: regresi (390) ==");
await openTemplate("#template-code", "Adu Kode");
await clickTab("Caption");
const CAP_BARU = "Verifikasi caption 23:26";
await page.locator('input[aria-label="Teks caption 1"]').fill(CAP_BARU);
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
console.log("\n== console/page errors (bagian 3): " + errors.length + " ==");
errors.slice(0, 10).forEach((e) => console.log("  ERR: " + e));
ok("E1 nol console/page error (bagian 3, template sehat)", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "");
await writeFile(`${OUT}/props-all-verify-headless-3.json`, JSON.stringify({ results, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `\nGAGAL: ${bad.length} dari ${results.length}` : `\nSEMUA HIJAU (${results.length})`);
process.exit(bad.length ? 1 : 0);
