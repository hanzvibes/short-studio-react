#!/usr/bin/env node
// Sweep: buka ke-12 template FRESH di studio, catat mana yang mencapai "Preview siap".
// Bukti empiris apakah injeksi beat (props-all) merusak template lain selain perang.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const TEMPLATES = [
  ["#template", "Versus"], ["#template-trio", "Trio"], ["#template-code", "Adu Kode"],
  ["#template-kuota", "Kuota"], ["#template-rival", "Rival"], ["#template-perang", "Perang"],
  ["#template-typing", "Mengetik"], ["#template-deploy", "Deploy"], ["#template-bughunter", "Pemburu Bug"],
  ["#template-bomb", "Bom"], ["#template-meeting", "Rapat"], ["#template-sleep", "Tidur"],
];
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const out = [];
for (const [hash, label] of TEMPLATES) {
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
  await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  const t0 = Date.now();
  let ready = false;
  try {
    await page.goto(`http://localhost:3000/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 45000 });
    ready = true;
  } catch { ready = false; }
  const ms = Date.now() - t0;
  const bridge = await page.evaluate(() => { try { const w = document.querySelector("#pv")?.contentWindow; return !!w?.__st && w.__st.ok(); } catch { return false; } }).catch(() => false);
  console.log(`${ready && bridge ? "OK  " : "FAIL"} ${label} (${hash}) ready=${ready} bridge=${bridge} ${ms}mdtk${errs.length ? " ERR: " + errs.join(" | ") : ""}`);
  out.push({ template: label, hash, ready, bridge, ms, errors: errs });
  await ctx.close();
}
await writeFile("/home/hatch/workspace/short-studio-react/verification/tdz-fix-sweep.json", JSON.stringify(out, null, 2));
await browser.close();
const bad = out.filter((o) => !(o.ready && o.bridge));
console.log(bad.length ? `GAGAL: ${bad.map((b) => b.template).join(", ")}` : "SEMUA 12 TEMPLATE SIAP");
process.exit(bad.length ? 1 : 0);
