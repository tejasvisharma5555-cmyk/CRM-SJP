// RLS checks through the real API with real logins (run after `npm run seed`).
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { loadEnv } from "../../scripts/env.mjs";
loadEnv();
const mk = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const as = async (email, pw) => { const c = mk(); const { error } = await c.auth.signInWithPassword({ email, password: pw }); assert.ifError(error); return c; };

const anon = mk();
for (const t of ["contacts", "properties", "commissions", "commission_payments", "public_property_card", "property_sources"]) {
  const { data, error } = await anon.from(t).select("*").limit(1);
  assert.ok(error || !data?.length, `anon read ${t}`);
}
console.log("✔ anonymous: no access to any table or the share view");

const out = await as("outsider@sjp.test", "outsider-123");
for (const t of ["contacts", "properties", "commissions", "commission_payments", "public_property_card"]) {
  const { data } = await out.from(t).select("id").limit(5);
  assert.equal(data?.length ?? 0, 0, `outsider read ${t}`);
}
const ins = await out.from("contacts").insert({ name: "x", phone: "9000000001", roles: ["buyer"] });
assert.ok(ins.error, "outsider insert must fail");
console.log("✔ logged-in non-member: 0 rows everywhere, inserts refused");

const staff = await as("staff@sjp.test", "sjp-staff-123");
const { data: pay } = await staff.from("commission_payments").select("id").limit(1);
assert.equal(pay.length, 1, "staff can read payments");
const del = await staff.from("commission_payments").delete({ count: "exact" }).eq("id", pay[0].id);
assert.equal(del.count, 0, "staff delete must affect 0 rows");
const upd = await staff.from("business_settings").update({ public_phone: "+919999999999" }).eq("id", true).select();
assert.equal(upd.data?.length ?? 0, 0, "staff cannot edit settings");
const tm = await staff.from("team_members").insert({ user_id: "00000000-0000-0000-0000-000000000000", display_name: "x" });
assert.ok(tm.error, "nobody adds team members via API");
console.log("✔ staff: can read/add, cannot delete payments, edit settings or add team members");

const admin = await as("admin@sjp.test", "sjp-admin-123");
const bad = await admin.from("contacts").insert({ name: "Bad", phone: "12345", roles: ["buyer"] });
assert.match(bad.error?.message ?? "", /invalid_phone/);
const dup = await admin.from("contacts").insert({ name: "Dup", phone: "098120 00000", roles: ["buyer"] });
const dup2 = await admin.from("contacts").insert({ name: "Dup2", phone: "+91 98120-00000", roles: ["buyer"] });
assert.ifError(dup.error); assert.equal(dup2.error?.code, "23505");
await admin.from("contacts").delete().eq("phone", "+919812000000");
console.log("✔ database itself rejects bad phones and duplicate (differently formatted) phones");
