import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/home/hatch/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox","--no-proxy-server","--enable-unsafe-swiftshader","--use-gl=swiftshader","--ignore-gpu-blocklist","--disable-dev-shm-usage"],
  env: { ...process.env, HTTP_PROXY:"",HTTPS_PROXY:"",http_proxy:"",https_proxy:"",ALL_PROXY:"",all_proxy:"",NO_PROXY:"*" },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdnThree = []; const vendor = new Set();
page.on("request", (r) => { const u=r.url();
  if (u.includes("cdnjs.cloudflare.com")||u.includes("cdn.jsdelivr.net")) cdnThree.push(u);
  if (u.includes("/vendor/")) vendor.add(u.split("/vendor/")[1]); });
await page.route("https://cdnjs.cloudflare.com/**", (r)=>r.abort());
await page.route("https://cdn.jsdelivr.net/**", (r)=>r.abort());
await page.route("https://fonts.googleapis.com/**", (r)=>r.abort());
await page.route("https://fonts.gstatic.com/**", (r)=>r.abort());
await page.goto("http://localhost:3101/?v=reprobe#template-code", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
await page.click(".tour-skip").catch(()=>{});
await page.fill("#fTitle", "Judul Reprobe");
await page.click("#apply");
await page.waitForFunction(() => document.body.textContent?.includes("Preview siap"), null, { timeout: 60000 });
// poll bridge sampai 30 dtk
let b=null;
for (let i=0;i<15;i++){ await page.waitForTimeout(2000);
  b = await page.evaluate(()=>{ const st=document.querySelector("#pv")?.contentWindow?.__st;
    const cv=document.querySelector("#pv")?.contentWindow?.document.querySelector("canvas");
    return st?{ok:st.ok(),len:st.len(),canvas:!!cv}:null; });
  if (b?.ok) break; }
const title = await page.evaluate(()=>document.querySelector("#pv")?.contentWindow?.document.getElementById("title")?.textContent?.trim().slice(0,60));
console.log(JSON.stringify({bridgeAfterEdit:b, title, cdnThree: cdnThree.length, vendorFiles: vendor.size}));
await browser.close();
process.exit(b?.ok && cdnThree.length===0 ? 0 : 1);
