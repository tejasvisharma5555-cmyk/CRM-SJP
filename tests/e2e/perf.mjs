// Load-time check emulating a low-end Android phone: 4x CPU slowdown + "slow 4G".
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["Moto G4"] });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", "admin@sjp.test"); await page.fill("#password", "sjp-admin-123");
await page.locator("form button").click(); await page.waitForURL(`${BASE}/`);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
for (const path of ["/", "/properties", "/contacts", "/commissions", "/contacts?role=broker&sort=listings"]) {
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: "load" });
  const ms = Date.now() - t0;
  const bytes = await page.evaluate(() => performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), 0)
    + (performance.getEntriesByType("navigation")[0]?.transferSize || 0));
  console.log(`${path.padEnd(38)} ${String(ms).padStart(5)} ms  ${(bytes / 1024).toFixed(0).padStart(4)} KB transferred (cold cache)`);
  await cdp.send("Network.clearBrowserCache");
}
await b.close();
