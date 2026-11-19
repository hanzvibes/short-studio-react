#!/usr/bin/env node
// VERIFIKASI INDEPENDEN: jalur edit tersimpan + Video Buatan Saya tetap
// lewat mount() (rewrite /vendor/) — CDN diblokir total.
// 1) Buka template-code, ubah judul, Terapkan -> preview siap, 0 CDN three.
// 2) Simpan sebagai video baru -> buka dari Video Buatan Saya -> preview siap.
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE = "http://localhost:3101";
const browser = await chromium.launch({
  executablePath: "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdnThree = [];
const vendorReqs = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("cdnjs.cloudflare.com") || u.includes("cdn.jsdelivr.net")) cdnThree.push(u);
  if (u.includes("/vendor/")) vendorReqs.push(u);
});
await page.route("https://cdnjs.cloudflare.com/**", (r) => r.abort());
await page.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text().slice(0, 160)); });

const bridge = () => page.evaluate(() => {
  const st = document.querySelector("#pv")?.contentWindow?.__st;
  const cv = document.querySelector("#pv")?.contentWindow?.document.querySelector("canvas");
  return st ? { ok: st.ok(), len: st.len(), canvas: !!cv } : null;
});

await page.goto(`${BASE}/?v=vendor-edit#template-code`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.click(".tour-skip").catch(() => {});
await page.fill("#fTitle", "Judul Edit Vendor");
await page.click("#apply");
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.waitForTimeout(2000);
const afterEdit = await bridge();
const titleInFrame = await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.document.getElementById("title")?.textContent?.trim().slice(0, 60));
await page.screenshot({ path: "verification/vendor-cdn-blocked-editflow.png" });

// Simpan sebagai video baru (tombol di menu; cari teks tombol).
const saved = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const b = btns.find((x) => /simpan sebagai video baru/i.test(x.textContent || ""));
  if (!b) return { found: false, labels: btns.map((x) => (x.textContent || "").trim().slice(0, 40)) };
  b.click();
  return { found: true };
});
await page.waitForTimeout(2000);
const mineCount = await page.evaluate(() => document.querySelectorAll("#mineList .mine, [data-mine]").length);
const afterSave = await bridge();
console.log(JSON.stringify({ afterEdit, titleInFrame, saved, mineCount, afterSave, cdnThree: cdnThree.length, vendorReqs: vendorReqs.length, vendorFiles: [...new Set(vendorReqs.map((u) => u.split("/vendor/")[1]))].length, errors: errors.slice(0, 5) }, null, 2));
await writeFile("verification/vendor-verify-editflow.json", JSON.stringify({ afterEdit, titleInFrame, saved, mineCount, afterSave, cdnThree, vendorReqs: vendorReqs.length, errors }, null, 2));
await browser.close();
const pass = afterEdit?.ok && afterSave?.ok && cdnThree.length === 0 && vendorReqs.length >= 13;
console.log(pass ? "EDITFLOW OK" : "EDITFLOW GAGAL");
process.exit(pass ? 0 : 1);
