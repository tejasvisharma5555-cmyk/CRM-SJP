// Create a login and add it to the team.
//   node scripts/add-user.mjs papa@example.com 'StrongPass#1' "Papa" admin
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
loadEnv();

const [email, password, name = "Admin", role = "admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error("usage: node scripts/add-user.mjs <email> <password> [display name] [admin|staff]");
  process.exit(1);
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error(error.message); process.exit(1); }
const ins = await sb.from("team_members").insert({ user_id: data.user.id, display_name: name, role });
if (ins.error) { console.error(ins.error.message); process.exit(1); }
console.log(`Added ${email} as ${role}`);
