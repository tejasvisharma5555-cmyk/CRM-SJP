import type { SupabaseClient } from "@supabase/supabase-js";

export interface BusinessSettings { business_name: string; public_phone: string; default_city: string }

export async function getSettings(sb: SupabaseClient): Promise<BusinessSettings> {
  const { data } = await sb.from("business_settings").select("business_name, public_phone, default_city").maybeSingle();
  return data ?? { business_name: "", public_phone: "", default_city: "Jind" };
}
