// Seeds realistic Hisar (Haryana) test data. LOCAL ONLY unless --force.
//   npm run seed
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(URL_) && !process.argv.includes("--force")) {
  console.error(`Refusing to wipe & seed non-local database ${URL_}. Pass --force if you really mean it.`);
  process.exit(1);
}
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => { if (r.error) { console.error(what, r.error); process.exit(1); } return r.data; };

// deterministic random
let seed = 20261117;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// ---------- wipe ----------
const WIPE = [["commission_payments", "id"], ["commissions", "id"], ["property_photos", "id"], ["property_sources", "id"],
  ["properties", "id"], ["contacts", "id"], ["team_members", "user_id"]];
for (const [tbl, col] of WIPE) must(await sb.from(tbl).delete().not(col, "is", null), `wipe ${tbl}`);
await sb.from("business_settings").delete().eq("id", true);
const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
for (const u of users.users) await sb.auth.admin.deleteUser(u.id);

// ---------- users ----------
async function user(email, password) {
  return must(await sb.auth.admin.createUser({ email, password, email_confirm: true }), "user").user;
}
const admin = await user("admin@sjp.test", "sjp-admin-123");
const staff = await user("staff@sjp.test", "sjp-staff-123");
await user("outsider@sjp.test", "outsider-123"); // logged in but NOT on the team
must(await sb.from("team_members").insert([
  { user_id: admin.id, display_name: "Papa", role: "admin" },
  { user_id: staff.id, display_name: "Helper", role: "staff" },
]), "team");
must(await sb.from("business_settings").insert({ business_name: "SJP Properties", public_phone: "+919876500001", default_city: "Hisar" }), "settings");

// ---------- contacts ----------
const BROKERS = [
  ["Rajesh Garg", "Red Square Market"], ["Sunil Mittal", "Model Town"], ["Vikas Goyal", "Sector 14"],
  ["Anil Saini", "Camp Chowk"], ["Pawan Bansal", "Patel Nagar"], ["Deepak Malik", "PLA"],
  ["Sandeep Redhu", "Delhi Road"], ["Naresh Jindal", "Sector 15"], ["Mukesh Dhull", "Rajgarh Road"],
  ["Rohit Singla", "Sector 13"], ["Satbir Lather", "Hansi"], ["Kuldeep Nain", "Barwala"],
];
const OWNERS = [
  ["Ramesh Kumar", "Sector 14"], ["Suresh Chand", "Azad Nagar"], ["Om Prakash Sharma", "Model Town"],
  ["Krishan Lal", "Patel Nagar"], ["Jagdish Sihag", "Satrod"], ["Balwan Singh", "Barwala"],
  ["Mahender Kundu", "Sirsa Road"], ["Rajbir Dhanda", "Delhi Road"], ["Sushila Devi", "Ashok Vihar"],
  ["Kamla Rani", "Vidyut Nagar"], ["Harish Arora", "Red Square Market"], ["Vinod Gupta", "Urban Estate II"],
  ["Ashok Jain", "Sector 13"], ["Dharambir Ahlawat", "Tosham Road"], ["Satish Kaushik", "Sector 14"],
  ["Rakesh Chahal", "Rajgarh Road"], ["Manoj Sangwan", "Sector 15"], ["Neelam Rani", "Azad Nagar"],
  ["Yashpal Nehra", "Hansi"], ["Bhupender Sheoran", "Sector 9-11"],
];
const BUYERS = [
  ["Amit Verma", "Hisar"], ["Pooja Sharma", "Hisar"], ["Gaurav Mor", "Hisar"], ["Ritu Goel", "Hisar"],
  ["Sachin Lohan", "Hansi"], ["Neeraj Punia", "Hisar"], ["Monika Rathi", "Hisar"], ["Ajay Duhan", "Hisar"],
];
let phoneSeq = 0;
const phone = () => `${pick(["98", "94", "99", "70", "81", "88"])}${String(12000000 + (phoneSeq++ * 7919) % 87000000).padStart(8, "0")}`;
const cityFor = (area) => (["Hansi", "Barwala"].includes(area) ? area : "Hisar");

const contactRows = [
  ...BROKERS.map(([name, area], i) => ({ name, area, city: cityFor(area), roles: ["broker"], phone: phone(),
    notes: i % 4 === 0 ? "Shares 50-50. Pays commission late, follow up." : null })),
  ...OWNERS.map(([name, area], i) => ({ name, area, city: cityFor(area), roles: i % 6 === 0 ? ["owner", "buyer"] : ["owner"], phone: phone(),
    alt_phone: i % 5 === 0 ? phone() : null, notes: i % 7 === 0 ? "Wants quick sale — going abroad" : null })),
  ...BUYERS.map(([name, city]) => ({ name, city, area: null, roles: ["buyer"], phone: phone() })),
];
// One broker who is also an owner
contactRows[1].roles = ["broker", "owner"];
const contacts = must(await sb.from("contacts").insert(contactRows).select("id, name, roles"), "contacts");
const byName = Object.fromEntries(contacts.map((c) => [c.name, c]));
const brokers = BROKERS.map(([n]) => byName[n]);
const owners = OWNERS.map(([n]) => byName[n]);
const buyers = BUYERS.map(([n]) => byName[n]);

// ---------- properties ----------
// [locality, min ₹/gaj, max ₹/gaj]
const HISAR = [
  ["Sector 13", 45000, 60000], ["Sector 14", 55000, 75000], ["Sector 15", 50000, 70000], ["Sector 16-17", 42000, 58000],
  ["Sector 9-11", 35000, 48000], ["Sector 1-4", 32000, 45000], ["Urban Estate II", 40000, 55000], ["Sector 33", 28000, 38000],
  ["PLA", 40000, 55000], ["Model Town", 38000, 52000], ["Patel Nagar", 22000, 32000], ["Azad Nagar", 18000, 26000],
  ["Ashok Vihar", 20000, 28000], ["Vidyut Nagar", 26000, 36000], ["Rajgarh Road", 16000, 24000], ["Delhi Road", 18000, 28000],
  ["Sirsa Road", 15000, 22000], ["Satrod", 12000, 18000], ["Tosham Road", 13000, 19000], ["Camp Chowk", 30000, 42000],
];
const NEARBY = [["Hansi", "Model Town Hansi", 14000, 22000], ["Barwala", "Barwala Main Road", 10000, 16000]];
const round = (n, to) => Math.round(n / to) * to;

const props = [];
function addProp(p) { props.push(p); return p; }

for (let i = 0; i < 58; i++) {
  const nearby = i % 9 === 0;
  const [city, locality, lo, hi] = nearby ? pick(NEARBY) : ["Hisar", ...pick(HISAR)];
  const kind = rnd();
  const viaBroker = rnd() < 0.6;
  const src = viaBroker ? pick(brokers) : pick(owners);
  const owner = viaBroker ? (rnd() < 0.45 ? pick(owners) : null) : src;
  const status = i < 10 ? "sold" : i < 13 ? "on_hold" : i < 15 ? "withdrawn" : i < 17 ? "rented" : "available";
  let p;
  if (kind < 0.5) {
    const gaj = pick([100, 112, 125, 150, 166, 200, 225, 250, 300, 400, 500]);
    p = { property_type: "plot", size_value: gaj, size_unit: "gaj", price: round(gaj * between(lo, hi), 50000), plot_no: `${between(1, 900)}${pick(["", "", "-A", "-B"])}` };
  } else if (kind < 0.72) {
    const gaj = pick([100, 125, 150, 200, 250]);
    p = { property_type: "house", size_value: gaj, size_unit: "gaj", price: round(gaj * between(lo, hi) * 1.6, 100000), plot_no: `H.No. ${between(1, 1500)}` };
  } else if (kind < 0.82) {
    const sqft = pick([180, 220, 300, 450, 600]);
    p = { property_type: pick(["shop", "shop", "showroom"]), size_value: sqft, size_unit: "sq_ft", price: round(sqft * between(5500, 12000), 50000), plot_no: `SCO ${between(1, 120)}` };
  } else if (kind < 0.9) {
    const acres = pick([1, 2, 2.5, 4, 5]);
    p = { property_type: "agri_land", size_value: acres, size_unit: pick(["acre", "killa"]), price: round(acres * between(3500000, 6000000), 100000), plot_no: null };
    p.locality_override = pick(["Village Ladwa", "Village Mirzapur", "Village Dhansu", "Village Talwandi Rana", "Village Kaimri"]);
  } else {
    const marla = pick([5, 8, 10, 12]);
    p = { property_type: "plot", size_value: marla, size_unit: "marla", price: round(marla * 30.25 * between(lo, hi), 50000), plot_no: String(between(1, 400)) };
  }
  const rent = status === "rented" || (p.property_type === "shop" && rnd() < 0.3);
  addProp({
    ...p,
    locality: p.locality_override ?? locality,
    city, status,
    purpose: rent ? "rent" : "sale",
    price: rent ? round(between(6000, 35000), 500) : p.price,
    price_negotiable: rnd() < 0.8,
    facing: pick([null, "East", "West", "North", "South", "Corner"]),
    road_width_ft: pick([null, 20, 24, 30, 40, 60]),
    listing_source: viaBroker ? "broker" : "direct_owner",
    source_contact_id: src.id,
    owner_contact_id: owner?.id ?? null,
    received_date: daysAgo(between(0, 240)),
    notes: rnd() < 0.2 ? pick(["Owner will accept 5% less", "Registry pending — check papers", "Keys with neighbour", "Bank loan on property"]) : null,
  });
}
// A known plot the dup-check demo can hit: Sector 14 Hisar, plot 112-A, 200 gaj, ₹1.3 crore
addProp({
  property_type: "plot", purpose: "sale", status: "available", city: "Hisar", locality: "Sector 14",
  plot_no: "112-A", size_value: 200, size_unit: "gaj", price: 13000000, price_negotiable: true, facing: "East", road_width_ft: 30,
  listing_source: "broker", source_contact_id: byName["Vikas Goyal"].id, owner_contact_id: byName["Ramesh Kumar"].id,
  received_date: daysAgo(12), notes: "Owner Ramesh ji wants 1.27 Cr final",
});
for (const p of props) delete p.locality_override;
const inserted = must(await sb.from("properties").insert(props).select("id, status, price, listing_source, source_contact_id, received_date, plot_no"), "properties");

// Same plot offered by a second (and third) broker
const multi = inserted.filter((p) => p.status === "available").slice(0, 6);
const extraSources = [];
for (const [i, p] of multi.entries()) {
  const others = brokers.filter((b) => b.id !== p.source_contact_id);
  extraSources.push({ property_id: p.id, contact_id: others[i % others.length].id, listing_source: "broker",
    received_date: daysAgo(between(0, 30)), quoted_price: p.price ? round(p.price * (1 + (rnd() - 0.4) * 0.06), 50000) : null });
  if (i < 2) extraSources.push({ property_id: p.id, contact_id: others[(i + 5) % others.length].id, listing_source: "broker", received_date: daysAgo(between(0, 10)), quoted_price: null });
}
must(await sb.from("property_sources").insert(extraSources), "extra sources");

// ---------- commissions ----------
const sold = inserted.filter((p) => p.status === "sold" || p.status === "rented");
const payments = [];
for (const [i, p] of sold.entries()) {
  const deal = p.price ? round(p.price * (0.95 + rnd() * 0.04), 10000) : null;
  const shared = p.listing_source === "broker";
  const total = deal ? (p.status === "rented" ? deal : deal * 0.02) : 20000;
  const expected = round(shared ? total * 0.5 : total, 500);
  const c = must(await sb.from("commissions").insert({
    property_id: p.id,
    type: shared ? "shared" : "direct",
    shared_with_contact_id: shared ? p.source_contact_id : null,
    buyer_contact_id: buyers[i % buyers.length].id,
    deal_amount: deal,
    our_share_percent: shared ? 50 : null,
    expected_amount: expected,
    deal_date: daysAgo(between(5, 120)),
    status: i === sold.length - 1 ? "written_off" : "expected",
    notes: i === 0 ? "Buyer paid token at office" : null,
  }).select("id").single(), "commission");
  const plan = i % 4; // 0 = nothing yet, 1 = part, 2 = full in two parts, 3 = part
  if (plan === 1 || plan === 3) payments.push({ commission_id: c.id, amount: round(expected * 0.4, 500), mode: pick(["cash", "upi"]), paid_on: daysAgo(between(1, 40)), note: "Advance" });
  if (plan === 2) {
    payments.push({ commission_id: c.id, amount: round(expected * 0.5, 500), mode: "upi", paid_on: daysAgo(between(20, 60)) });
    payments.push({ commission_id: c.id, amount: expected - round(expected * 0.5, 500), mode: pick(["cash", "bank", "cheque"]), paid_on: daysAgo(between(1, 19)), note: "Final" });
  }
}
if (payments.length) must(await sb.from("commission_payments").insert(payments), "payments");

const counts = {};
for (const t of ["contacts", "properties", "property_sources", "commissions", "commission_payments"]) {
  counts[t] = (await sb.from(t).select("id", { count: "exact", head: true })).count;
}
console.log("Seeded:", counts);
console.log("Login: admin@sjp.test / sjp-admin-123   (staff@sjp.test / sjp-staff-123, outsider@sjp.test / outsider-123 = not on team)");
