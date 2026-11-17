import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("http://localhost:3000/#template-kuota", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.click(".tour-skip").catch(() => {});
await page.click('button[role="tab"]:has-text("Caption")');
await page.waitForTimeout(400);
await page.fill(".edit-cap .cap-text >> nth=0", "EDIT UI KUOTA");
await page.click('button.btn.primary:has-text("Terapkan semua edit")');
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 90000 });
await page.waitForTimeout(1500);
const got = await page.evaluate(() => document.querySelector("#pv")?.contentWindow?.__st?.caps()?.[0]?.[2] ?? null);
console.log("caps()[0][2] sesudah Terapkan:", JSON.stringify(got));
await browser.close();
process.exit(got === "EDIT UI KUOTA" ? 0 : 1);
