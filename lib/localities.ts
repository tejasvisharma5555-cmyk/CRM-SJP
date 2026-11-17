import type { SupabaseClient } from "@supabase/supabase-js";

/** Common Jind / Hisar localities, merged with whatever has been typed before. */
const COMMON = [
  "Urban Estate Sector 8", "Urban Estate Sector 9", "Urban Estate Sector 10", "Urban Estate Sector 11",
  "Patiala Chowk", "Rohtak Road", "Gohana Road", "Safidon Road", "Hisar Road", "Bhiwani Road",
  "Model Town", "Shiv Colony", "Ram Nagar", "Arban Estate", "Krishna Colony", "Dayanand Nagar",
  "Sector 13", "Sector 14", "Sector 15", "Sector 16-17", "PLA", "Red Square Market",
];

export async function getLocalities(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from("properties").select("locality").order("received_date", { ascending: false }).limit(1000);
  const seen = new Map<string, string>();
  for (const l of [...(data ?? []).map((r) => r.locality as string), ...COMMON]) {
    const k = l.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (k && !seen.has(k)) seen.set(k, l);
  }
  return [...seen.values()];
}
