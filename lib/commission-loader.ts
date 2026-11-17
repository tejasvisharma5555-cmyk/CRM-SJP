import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadPropertyBrief(sb: SupabaseClient, propertyId: string) {
  const { data } = await sb.from("properties")
    .select("id, property_type, locality, city, size_value, size_unit, price")
    .eq("id", propertyId).maybeSingle();
  return data;
}
