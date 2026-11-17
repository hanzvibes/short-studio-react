import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const VENDOR = "/tmp/ss-vendor";
const CHROME = "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: CHROME,
  env: { ...process.env, HTTP_PROXY: "", HTTPS_PROXY: "", http_proxy: "", https_proxy: "", ALL_PROXY: "", all_proxy: "", NO_PROXY: "*" },
  args: ["--no-sandbox", "--no-proxy-server", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", async (r) =>
  r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/three.min.js`) }));
await page.route("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/**", async (r) => {
  const rel = r.request().url().replace("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/", "");
  return r.fulfill({ contentType: "text/javascript", body: await readFile(`${VENDOR}/${rel}`) });
});
await page.route("https://fonts.googleapis.com/**", async (r) => r.fulfill({ contentType: "text/css", body: "/* x */" }));
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
await page.goto("file:///home/hatch/workspace/short-studio-react/public/templates/template-perang.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => ({
  FA: typeof FA, mlay: typeof mlay, cm: typeof cm, dm: typeof dm, fA: typeof fA,
  cmPos: typeof cm !== "undefined" ? typeof cm.position : "n/a",
  fAVal: typeof fA !== "undefined" ? String(fA).slice(0, 80) : "n/a",
  cmVal: typeof cm !== "undefined" ? String(cm).slice(0, 80) : "n/a",
})));
await browser.close();
