#!/usr/bin/env node
// Verifikasi headless: edit caption/props benar-benar mengubah preview.
// Bagian A — per template (12/12): edit caption pertama via apply-edit.mjs,
// muat HTML hasil edit, buktikan caps()[0] berubah + bubble tampil di screenshot.
// Bagian B — UI studio (template-code + template-kuota, butuh `npm start` jalan):
// edit caption lewat tab Caption, Terapkan, buktikan __st.caps() berubah;
// edit props claude.x lewat tab Props; simpan sebagai video baru + reload.
// Usage: npm start (terminal lain) lalu: node scripts/verify-edits.mjs [studioUrl]
// Chrome headless shell + intersepsi vendor lokal (CDN tidak bisa dicapai
// Chromium sandbox di VM ini; template di disk TIDAK diubah).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TPL = join(ROOT, "public", "templates");
const OUT = join(ROOT, "verification");
const VENDOR = process.env.VENDOR_DIR || "/tmp/ss-vendor";
const SHELL = process.env.CHROME_PATH || "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const STUDIO = process.argv[2] || "http://localhost:3000/";
await mkdir(OUT, { recursive: true });
await mkdir("/tmp/edit-specs", { recursive: true });
await mkdir("/tmp/edited", { recursive: true });

const files = (await readdir(TPL)).filter((f) => f.endsWith(".html")).sort();
const results = [];
const fail = (m) => { console.log("FAIL " + m); results.push({ ok: false, m }); };
const pass = (m) => { console.log("OK   " + m); results.push({ ok: true, m }); };

const browser = await chromium.launch({
  executablePath: SHELL,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
async function newPage(vp = { width: 540, height: 960 }) {
  const page = await browser.newPage({ viewport: vp });
  page.on("pageerror", () => {});
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
    r.fulfill({ contentType: "text/javascript", body: await readFile(join(VENDOR, "three.min.js")) }));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
    const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
    return r.fulfill({ contentType: "text/javascript", body: await readFile(join(VENDOR, rel)) });
  });
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "/* fallback */" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
  return page;
}
const readGlobals = () => {
  try {
    return {
      len: typeof LEN === "number" ? LEN : null,
      caps: typeof caps !== "undefined" ? caps : null,
      shots: typeof shots !== "undefined" ? shots : null,
      vo: typeof VO !== "undefined" ? VO : null,
      x: typeof X !== "undefined" ? X : null,
    };
  } catch { return { len: null, caps: null, shots: null, vo: null, x: null }; }
};

// ---------- Bagian A: satu edit caption (+props code/kuota) per template ----------
for (const file of (process.env.SKIP_A ? [] : files)) {
  const slug = file.replace(/\.html$/, "");
  try {
    const page = await newPage();
    await page.goto(`http://localhost:8898/${file}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => typeof window.renderAt === "function", null, { timeout: 60000 });
    const g = await page.evaluate(readGlobals);
    if (!g.caps || !g.caps.length) { fail(`${file}: caps tidak terbaca`); await page.close(); continue; }
    const caps = g.caps.map((c) => [...c]);
    caps[0][2] = "EDIT BUKTI";
    const spec = { file, caps };
    if (file === "template-code.html") spec.props = { "claude.x": -1.2 };
    if (file === "template-kuota.html") spec.props = { "claude.x": -1.2 };
    const specPath = `/tmp/edit-specs/${slug}.json`;
    await writeFile(specPath, JSON.stringify(spec, null, 2));
    execFileSync("node", ["scripts/apply-edit.mjs", "--file", file, "--edit", specPath, "--out", `/tmp/edited/${file}`], { cwd: ROOT, stdio: "pipe" });
    await page.goto(`http://localhost:8899/${file}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => typeof window.renderAt === "function", null, { timeout: 60000 });
    const g2 = await page.evaluate(readGlobals);
    const capOk = g2.caps && g2.caps[0] && g2.caps[0][2] === "EDIT BUKTI";
    let extra = "";
    if (file === "template-kuota.html") {
      const voOk = g2.vo && g2.vo[0] === "EDIT BUKTI";
      extra = ` vo-follows=${voOk}`;
      if (!voOk) fail(`${file}: VO[0] tidak mengikuti caps baru`);
    }
    if (file === "template-code.html" || file === "template-kuota.html") {
      // X adalah const lokal di frame() (bukan global), jadi buktikan lewat isi file hasil edit
      const editedText = await readFile(`/tmp/edited/${file}`, "utf8");
      const xOk = /X=\[-1\.2,/.test(editedText);
      extra += ` claude.x-in-file=${xOk}`;
      if (!xOk) fail(`${file}: props claude.x tidak ada di file hasil edit`);
    }
    if (!capOk) { fail(`${file}: caps()[0] bukan EDIT BUKTI`); await page.close(); continue; }
    await page.evaluate((t) => window.renderAt(t), g2.caps[0][0] + 0.5);
    await page.waitForTimeout(1500);
    const stage = await page.$("#stage");
    await stage.screenshot({ path: join(OUT, `edit-${slug}.png`) });
    const cv = await page.evaluate(() => { const c = document.querySelector("canvas"); return c ? [c.width, c.height] : null; });
    pass(`${file}: caps[0]="EDIT BUKTI" + bubble diedit-${slug}.png, canvas=${cv}${extra}`);
    await page.close();
  } catch (e) {
    fail(`${file}: ${String(e).slice(0, 200)}`);
  }
}

// ---------- Bagian B: UI studio ----------
async function studioOk() {
  try {
    const r = await fetch(STUDIO, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch { return false; }
}
if (await studioOk()) {
  for (const [hash, marker] of [["#template-code", "EDIT UI KODE"], ["#template-kuota", "EDIT UI KUOTA"]]) {
    try {
      const page = await newPage({ width: 1440, height: 900 });
      await page.goto(STUDIO + hash, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(5000);
      await page.click(".tour-skip").catch(() => {});
      await page.click('button[role="tab"]:has-text("Caption")');
      await page.waitForTimeout(400);
      await page.fill(".edit-cap .cap-text >> nth=0", marker);
      await page.click('button.btn.primary:has-text("Terapkan semua edit")');
      await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const got = await page.evaluate(() => {
        const pv = document.querySelector("#pv");
        return pv?.contentWindow?.__st?.caps()?.[0]?.[2] ?? null;
      });
      if (got === marker) pass(`UI ${hash}: caps()[0]="${marker}" sesudah Terapkan`);
      else fail(`UI ${hash}: caps()[0]=${JSON.stringify(got)} (harap "${marker}")`);
      await page.screenshot({ path: join(OUT, `ui-edit-${hash.slice(1)}.png`) });
      // Props: ubah claude.x lewat tab Props (field number pertama di grup Maskot)
      await page.click('button[role="tab"]:has-text("Props")');
      await page.waitForTimeout(400);
      const propInput = page.locator('.prop-row input[type="number"]').first();
      if (await propInput.count()) {
        await propInput.fill("-1.2");
        await page.click('button.btn.primary:has-text("Terapkan semua edit")');
        await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 90000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const srcdocHas = await page.evaluate(() => {
          const pv = document.querySelector("#pv");
          const sd = pv?.getAttribute("srcdoc") || "";
          return /X=\[-1\.2,/.test(sd);
        });
        if (srcdocHas) pass(`UI ${hash}: props claude.x=-1.2 ada di srcdoc iframe sesudah Terapkan`);
        else fail(`UI ${hash}: props claude.x tidak ada di srcdoc iframe`);
      } else {
        fail(`UI ${hash}: tidak ada input number di tab Props`);
      }
      // Simpan sebagai video baru + reload
      await page.click('button[title="Simpan video saat ini sebagai video baru"]');
      await page.waitForTimeout(400);
      await page.fill('dialog input >> nth=0', `Video Uji ${marker}`);
      await page.click('button:has-text("Simpan video")');
      await page.waitForTimeout(800);
      const mineCount = await page.locator(".mine-item").count();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const mineAfter = await page.locator(".mine-item").count();
      if (mineCount >= 1 && mineAfter >= 1) pass(`UI ${hash}: "Video Buatan Saya" tersimpan + bertahan sesudah reload (${mineAfter} entri)`);
      else fail(`UI ${hash}: video baru tidak bertahan (sebelum=${mineCount} sesudah=${mineAfter})`);
      await page.close();
    } catch (e) {
      fail(`UI ${hash}: ${String(e).slice(0, 200)}`);
    }
  }
} else {
  console.log("SKIP Bagian B: studio tidak jalan di " + STUDIO + " (jalankan `npm start` dulu)");
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\nverify-edits: ${results.length - bad.length}/${results.length} lolos`);
if (bad.length) { console.log("GAGAL:"); bad.forEach((b) => console.log(" - " + b.m)); process.exit(1); }
