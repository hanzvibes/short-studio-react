#!/usr/bin/env node
// Verifikasi ulang #2 — CLI: edit beat ke file hasil CLI, render langsung,
// buktikan tanpa TDZ + LEN benar; terapkan 2x (idempotensi: satu deklarasi).
//   node verification/verify2-cli.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = "/home/hatch/workspace/short-studio-react";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";

function cli(file, specObj, out) {
  const spec = `/tmp/v2-spec-${out.replace(/[^a-z0-9]/gi, "")}.json`;
  writeFileSync(spec, JSON.stringify(specObj));
  execFileSync("node", ["scripts/apply-edit.mjs", "--file", file, "--edit", spec, "--out", `/tmp/v2-out/${out}`], { cwd: ROOT, stdio: "pipe" });
}
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("/tmp/v2-out", { recursive: true });

// 1) Perang beat.war 13.5
cli("template-perang.html", { props: { "beat.war": 13.5 } }, "perang-beat135.html");
const perang = await readFile("/tmp/v2-out/perang-beat135.html", "utf8");
const declWar = perang.split("\n").findIndex((l) => l.includes("const T_WAR=13.5;")) + 1;
const usesWar = perang.split("\n").map((l, i) => (l.includes("T_WAR") && !l.includes("const T_WAR") ? i + 1 : 0)).filter(Boolean);
console.log(`Perang beat.war=13.5: decl const T_WAR=13.5; di baris ${declWar}; pemakaian di baris ${usesWar.slice(0, 6).join(",")}${usesWar.length > 6 ? "..." : ""} (total ${usesWar.length}); decl<uses=${usesWar.every((u) => u > declWar)}`);
console.log(`Perang: jumlah 'const T_WAR=' = ${(perang.match(/const T_WAR=/g) || []).length}`);

// 2) Idempotensi: terapkan lagi beat.war 13.5 ke hasil pertama
execFileSync("node", ["scripts/apply-edit.mjs", "--file", "/tmp/v2-out/perang-beat135.html", "--edit", "/tmp/v2-spec-perangbeat135html.json", "--out", "/tmp/v2-out/perang-beat135-x2.html"], { cwd: ROOT, stdio: "pipe" });
const perang2 = await readFile("/tmp/v2-out/perang-beat135-x2.html", "utf8");
console.log(`Perang terapkan 2x: jumlah 'const T_WAR=' = ${(perang2.match(/const T_WAR=/g) || []).length} (harap 1); masih 13.5=${perang2.includes("const T_WAR=13.5;")}`);

// 3) Kuota tank.curve baris 3: 92 -> 30 + keyboard.x
cli("template-kuota.html", { props: { "tank.curve": [[0, 100], [2, 92], [5, 30], [8, 12]] } }, "kuota-tank30.html");
const kuota = await readFile("/tmp/v2-out/kuota-tank30.html", "utf8");
console.log(`Kuota tank.curve: memuat [5,30]=${kuota.includes("[5,30]")}; jumlah 'const KB_X=' = ${(kuota.match(/const KB_X=/g) || []).length}`);

// 4) Deploy beat.done (template yang dulu gagal)
cli("template-deploy.html", { props: { "beat.done": 25 } }, "deploy-done25.html");
const deploy = await readFile("/tmp/v2-out/deploy-done25.html", "utf8");
const declDone = deploy.split("\n").findIndex((l) => l.includes("const T_DONE=25;")) + 1;
console.log(`Deploy beat.done=25: decl di baris ${declDone}; jumlah 'const T_DONE=' = ${(deploy.match(/const T_DONE=/g) || []).length}`);

// 5) Render langsung ketiganya + aslinya sebagai kontrol
const browser = await chromium.launch({
  executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fb */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
// Sajikan /tmp/v2-out lewat route file:// -> baca langsung via file URL tidak bisa karena module? pakai setContent.
for (const [file, t, label] of [
  ["/tmp/v2-out/perang-beat135.html", 15, "Perang beat13.5"],
  ["/tmp/v2-out/perang-beat135-x2.html", 15, "Perang beat13.5 x2"],
  ["/tmp/v2-out/kuota-tank30.html", 6, "Kuota tank30"],
  ["/tmp/v2-out/deploy-done25.html", 20, "Deploy done25"],
]) {
  errs.length = 0;
  const html = await readFile(file, "utf8");
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => typeof window.renderAt === "function", null, { timeout: 60000 });
  const len = await page.evaluate(() => (typeof LEN === "number" ? LEN : null));
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.waitForTimeout(1200);
  console.log(`Render ${label}: LEN=${len} pageerror/console-error=${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}`);
  if (label.startsWith("Perang beat13.5 ") || label === "Kuota tank30")
    await page.screenshot({ path: `/home/hatch/workspace/short-studio-react/verification/verify2-cli-${label.split(" ")[0].toLowerCase()}.png` });
}
await browser.close();
console.log("CLI SELESAI");
