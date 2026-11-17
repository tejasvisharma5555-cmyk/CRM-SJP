import type { SupabaseClient } from "@supabase/supabase-js";

/** Common Hisar (and nearby) localities, merged with whatever has been typed before. */
const COMMON = [
  // Hisar — HSVP / HUDA sectors
  "Sector 1-4", "Sector 5", "Sector 9-11", "Sector 13", "Sector 14", "Sector 15", "Sector 16-17",
  "Sector 33", "Urban Estate I", "Urban Estate II",
  // Hisar — colonies & roads
  "Model Town", "PLA", "Red Square Market", "Camp Chowk", "Patel Nagar", "Azad Nagar", "Ashok Vihar",
  "Vidyut Nagar", "Jindal Chowk", "Rajgarh Road", "Delhi Road", "Sirsa Road", "Barwala Road",
  "Tosham Road", "Satrod", "Dabra Chowk", "Mill Gate", "Auto Market",
  // nearby
  "Hansi", "Barwala", "Adampur", "Uklana",
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
