// End-to-end walkthrough against a running app + seeded local Supabase.
//   npm run build && npm start   (in another shell)
//   node tests/e2e/flows.mjs [screenshotDir]
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../../scripts/env.mjs";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
loadEnv();
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv[2];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(["PASS", name]); console.log("✔", name); }
  catch (e) { results.push(["FAIL", name, e.message]); console.log("✘", name, "\n   ", e.message.split("\n")[0]); }
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 5"] });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("   [pageerror]", e.message));

async function login(email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.locator("form button").click();
  await page.waitForURL(`${BASE}/`);
}

await step("logged-out user is redirected to /login", async () => {
  await page.goto(`${BASE}/contacts`);
  assert.equal(new URL(page.url()).pathname, "/login");
});

await step("wrong password shows error", async () => {
  await page.fill("#email", "admin@sjp.test");
  await page.fill("#password", "nope");
  await page.locator("form button").click();
  await page.getByText("ईमेल या पासवर्ड गलत है").waitFor();
});

await step("admin logs in; Hindi by default; toggle to English", async () => {
  await login("admin@sjp.test", "sjp-admin-123");
  await page.getByRole("heading", { name: "SJP प्रॉपर्टी" }).waitFor();
  await shot(page, "01-home-hindi");
  await page.getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("heading", { name: "SJP Property" }).waitFor();
  await page.getByText("Total pending").first().waitFor();
  await shot(page, "02-home-english");
});

// ---------------- contacts ----------------
const { data: rajesh } = await svc.from("contacts").select("id, name, phone").eq("name", "Rajesh Garg").single();

await step("contacts: search by name and by phone fragment", async () => {
  await page.goto(`${BASE}/contacts`);
  await page.getByPlaceholder("Search name or phone").fill("garg");
  await page.waitForURL(/q=garg/);
  await page.getByText("Rajesh Garg").waitFor();
  const digits = rajesh.phone.slice(3);
  await page.getByPlaceholder("Search name or phone").fill(`0${digits.slice(0, 5)} ${digits.slice(5)}`);
  await page.waitForURL(/q=0/);
  await page.locator(".row .t1", { hasText: "Rajesh Garg" }).waitFor();
  assert.equal(await page.locator(".row").count(), 1);
});

await step("contacts: filter Broker + sort by most listings", async () => {
  await page.goto(`${BASE}/contacts?role=broker&sort=listings`);
  const lines = await page.locator(".row .t2:nth-child(3)").allInnerTexts();
  const counts = lines.map((l) => Number(l.match(/(\d+) listings/)[1]));
  assert.ok(counts.length >= 10, "expected brokers");
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  await shot(page, "03-contacts-brokers");
});

await step("contact duplicate phone is BLOCKED with 'Already saved as'", async () => {
  await page.goto(`${BASE}/contacts/new`);
  const d = rajesh.phone.slice(3);
  await page.fill("#c-phone", `+91-${d.slice(0, 5)}-${d.slice(5)}`);
  await page.fill("#c-name", "Someone Else");
  await page.getByText("Already saved as").waitFor();
  await page.locator(".alert.warn b", { hasText: "Rajesh Garg" }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Save", exact: true }).isDisabled());
  await shot(page, "04-contact-duplicate");
  await page.getByRole("link", { name: "Open" }).click();
  await page.waitForURL(`${BASE}/contacts/${rajesh.id}`);
});

await step("invalid phone rejected", async () => {
  await page.goto(`${BASE}/contacts/new`);
  await page.fill("#c-phone", "54321 12345");
  await page.fill("#c-name", "X");
  await page.getByText("Enter a 10-digit mobile").waitFor();
});

let newContactId;
await step("similar name in same area warns, then saves on confirm", async () => {
  await page.goto(`${BASE}/contacts/new`);
  await page.fill("#c-phone", "7015 551 234");
  await page.fill("#c-name", "Ramesh Kumaar");
  await page.getByRole("button", { name: "Owner" }).click();
  await page.fill("#c-area", "urban estate");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Similar name already in this area").waitFor();
  await page.locator(".alert.warn b", { hasText: "Ramesh Kumar" }).waitFor();
  await shot(page, "05-contact-similar");
  await page.getByRole("button", { name: /different person/ }).click();
  await page.waitForURL(/\/contacts\/[0-9a-f-]{36}$/);
  newContactId = page.url().split("/").pop();
  const { data } = await svc.from("contacts").select("phone").eq("id", newContactId).single();
  assert.equal(data.phone, "+917015551234");
});

await step("contact page: Call + WhatsApp links, listings, commission summary", async () => {
  await page.goto(`${BASE}/contacts/${rajesh.id}`);
  assert.equal(await page.getByRole("link", { name: /Call/ }).first().getAttribute("href"), `tel:${rajesh.phone}`);
  assert.equal(await page.getByRole("link", { name: /WhatsApp/ }).first().getAttribute("href"), `https://wa.me/${rajesh.phone.slice(1)}`);
  await page.getByText("Properties from this person").waitFor();
  await page.getByText("Commission with this person").waitFor();
  await shot(page, "06-contact-page");
});

// ---------------- properties ----------------
const { data: known } = await svc.from("properties").select("id").eq("plot_no", "112-A").eq("locality", "Urban Estate Sector 8").single();

await step("duplicate listing warns; 'Same property' links 2nd broker to existing", async () => {
  await page.goto(`${BASE}/properties/new`);
  await page.getByRole("button", { name: /Broker/ }).first().click();
  await page.getByLabel("Given by").fill("sunil");
  await page.locator(".row .t1", { hasText: "Sunil Mittal" }).click();
  await page.fill("#p-loc", "urban estate sector-8");
  await page.fill("#p-plot", "112 A");
  await page.fill("#p-size", "200");
  await page.fill("#p-price", "68 lakh");
  await page.getByText("= ₹68 Lakh").waitFor();
  await shot(page, "07-property-form");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("This may already be saved").waitFor();
  await page.getByText("Same colony and plot number").waitFor();
  await shot(page, "08-duplicate-sheet");
  await page.getByRole("button", { name: /Same property/ }).click();
  await page.waitForURL(`${BASE}/properties/${known.id}`);
  await page.locator(".row .t1", { hasText: "Sunil Mittal" }).waitFor();
  await page.locator(".row .t1", { hasText: "Vikas Goyal" }).waitFor();
  const { count } = await svc.from("properties").select("id", { count: "exact", head: true }).eq("plot_no", "112-A");
  assert.equal(count, 1, "no second property row created");
});

let newPropId;
await step("add property with inline NEW contact (direct owner); owner auto = source", async () => {
  await page.goto(`${BASE}/properties/new`);
  await page.getByRole("button", { name: /Direct owner/ }).click();
  await page.getByLabel("Given by").fill("8950012345");
  await page.getByRole("button", { name: "+ New contact" }).click();
  const sheet = page.getByRole("dialog");
  assert.equal(await sheet.locator("#c-phone").inputValue(), "89500 12345");
  await sheet.locator("#c-name").fill("Jai Bhagwan");
  await sheet.locator("#c-area").fill("Ram Nagar");
  await shot(page, "09-inline-contact");
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".row .t1", { hasText: "✓ Jai Bhagwan" }).waitFor();
  await page.getByRole("button", { name: "House" }).click();
  await page.fill("#p-loc", "Ram Nagar");
  await page.fill("#p-plot", "H.No. 77");
  await page.fill("#p-size", "150");
  await page.fill("#p-price", "41.5 lakh");
  await page.getByRole("button", { name: "＋ Details" }).click();
  await page.fill("#p-notes", "SECRET-NOTE owner shifting to Canada");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dup = page.getByText("This may already be saved");
  await Promise.race([page.waitForURL(/\/properties\/[0-9a-f-]{36}$/), dup.waitFor()]);
  if (await dup.isVisible()) await page.getByRole("button", { name: /Different property/ }).click();
  await page.waitForURL(/\/properties\/[0-9a-f-]{36}$/);
  newPropId = page.url().split("/").pop();
  const { data } = await svc.from("properties").select("owner_contact_id, source_contact_id, price").eq("id", newPropId).single();
  assert.equal(data.owner_contact_id, data.source_contact_id);
  assert.equal(Number(data.price), 4150000);
  const { data: c } = await svc.from("contacts").select("roles, listings_count").eq("id", data.source_contact_id).single();
  assert.deepEqual(c.roles, ["owner"]);
  assert.equal(c.listings_count, 1);
});

await step("'Different property' creates a separate listing", async () => {
  await page.goto(`${BASE}/properties/new`);
  await page.getByRole("button", { name: /Broker/ }).first().click();
  await page.getByLabel("Given by").fill("deepak");
  await page.locator(".row .t1", { hasText: "Deepak Malik" }).click();
  await page.fill("#p-loc", "Urban Estate Sector 8");
  await page.fill("#p-size", "1800");
  await page.getByRole("button", { name: "Sq ft" }).click();          // 1800 sq ft = 200 gaj
  await page.fill("#p-price", "67 lakh");                              // within 5% of 68 L
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Same colony, same size, similar price").waitFor();
  await page.getByRole("button", { name: /Different property/ }).click();
  await page.waitForURL(/\/properties\/[0-9a-f-]{36}$/);
  assert.notEqual(page.url().split("/").pop(), known.id);
});

await step("photo upload (resized, stored privately)", async () => {
  await page.goto(`${BASE}/properties/${newPropId}`);
  // 1600x1200 test image generated in-browser
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 1600; c.height = 1200;
    const g = c.getContext("2d"); g.fillStyle = "#c58b4a"; g.fillRect(0, 0, 1600, 1200);
    g.fillStyle = "#fff"; g.font = "120px sans-serif"; g.fillText("House 150 gaj", 300, 640);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: "house.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.locator(".photos img").first().waitFor({ timeout: 15000 });
  const { data } = await svc.from("property_photos").select("storage_path").eq("property_id", newPropId);
  assert.equal(data.length, 1);
  const { data: blob } = await svc.storage.from("property-photos").download(data[0].storage_path);
  assert.equal(blob.type, "image/jpeg");
  const anonUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-photos/${data[0].storage_path}`;
  const r = await fetch(anonUrl);
  assert.ok(r.status >= 400, `public URL must not work (got ${r.status})`);
  await shot(page, "10-property-detail");
});

await step("share message: only public fields; plot no. hidden until toggled", async () => {
  await page.goto(`${BASE}/properties/${newPropId}/share`);
  const preview = page.getByTestId("share-preview");
  await preview.waitFor();
  let text = await preview.innerText();
  for (const bad of ["Jai Bhagwan", "8950012345", "89500 12345", "SECRET", "Canada", "H.No. 77"]) {
    assert.ok(!text.includes(bad), `leaked "${bad}" in:\n${text}`);
  }
  assert.match(text, /House/); assert.match(text, /Ram Nagar/); assert.match(text, /150/); assert.match(text, /41\.5/);
  assert.match(text, /98765 00001/);
  await page.getByLabel("Show plot number").check();
  text = await preview.innerText();
  assert.match(text, /H\.No\. 77/);
  const href = await page.getByRole("link", { name: /Send on WhatsApp/ }).getAttribute("href");
  assert.ok(href.startsWith("https://wa.me/?text="));
  await shot(page, "11-share");
});

await step("properties filters: source, broker, status", async () => {
  await page.goto(`${BASE}/properties?source=direct_owner`);
  await page.locator(".row").first().waitFor();
  const srcTexts = await page.locator(".row .t2").allInnerTexts();
  assert.ok(srcTexts.every((t) => t.includes("Direct owner")), "only direct owner rows");
  await page.goto(`${BASE}/properties`);
  await page.getByLabel("Broker").selectOption({ label: /Sunil Mittal/ });
  await page.waitForURL(/broker=/);
  await page.locator(".row", { hasText: "Urban Estate Sector 8" }).first().waitFor();
  await page.goto(`${BASE}/properties?status=sold`);
  const badges = await page.locator(".row .badge").allInnerTexts();
  assert.ok(badges.length > 0 && badges.every((b) => b === "Sold"));
  await shot(page, "12-properties-sold");
});

// ---------------- commission ----------------
await step("add shared commission, add payment → pending recomputed", async () => {
  await page.goto(`${BASE}/properties/${newPropId}`);
  const before = await (await page.request.get(`${BASE}/commissions`)).text();
  await page.getByRole("link", { name: /Add commission/ }).click();
  await page.getByRole("button", { name: "Shared with broker" }).click();
  await page.getByLabel("Shared with").fill("rajesh");
  await page.locator(".row .t1", { hasText: "Rajesh Garg" }).click();
  await page.fill("#cm-exp", "20,000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/commissions\/[0-9a-f-]{36}$/);
  assert.equal(await page.getByTestId("pending").innerText(), "₹20,000");
  await page.getByRole("button", { name: /Add payment/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#pay-amt").fill("5k");
  await sheet.getByRole("button", { name: "UPI" }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Part received").first().waitFor();
  assert.equal(await page.getByTestId("pending").innerText(), "₹15,000");
  await shot(page, "13-commission-detail");
  void before;
});

await step("commission screen: total pending = sum of open deals", async () => {
  await page.goto(`${BASE}/commissions`);
  const shown = Number((await page.getByTestId("total-pending").innerText()).replace(/[₹,]/g, ""));
  const { data } = await svc.from("commission_overview").select("pending_amount, status").in("status", ["expected", "partially_received"]);
  const expected = data.reduce((s, r) => s + Math.max(0, Number(r.pending_amount)), 0);
  assert.equal(shown, expected);
  await shot(page, "14-commissions");
});

await step("tap '+ ₹' on commission list → add payment sheet", async () => {
  await page.goto(`${BASE}/commissions`);
  await page.getByRole("button", { name: "+ ₹" }).first().click();
  await page.getByRole("dialog").getByText("Add payment").first().waitFor();
  assert.equal(new URL(page.url()).pathname, "/commissions");
});

await step("outsider (logged in, not on team) is refused", async () => {
  await ctx.clearCookies();
  await login("outsider@sjp.test", "outsider-123");
  await page.getByText("not allowed").waitFor();
});

await browser.close();

const failed = results.filter((r) => r[0] === "FAIL");
writeFileSync("tests/e2e/last-run.txt", results.map((r) => r.join(" | ")).join("\n") + "\n");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
