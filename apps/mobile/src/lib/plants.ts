import type { CareEdit, IdentifyResult } from "@plant-tracker/shared";
import { supabase } from "./supabase";

export interface PlantDetail {
  id: string;
  nickname: string;
  species_common: string | null;
  species_scientific: string | null;
  photo_path: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  care: {
    description: string | null;
    light: string | null;
    water_min_days: number | null;
    water_max_days: number | null;
    water_notes: string | null;
    water_how: string | null;
    health_signs: string | null;
    source: "ai" | "manual";
  } | null;
  lastWatered: string | null;
}

export async function getPlant(id: string): Promise<PlantDetail> {
  const { data, error } = await supabase
    .from("plants")
    .select("*, care_profiles(*), watering_events(watered_at)")
    .eq("id", id)
    .order("watered_at", { referencedTable: "watering_events", ascending: false })
    .limit(1, { referencedTable: "watering_events" })
    .single();
  if (error) throw error;
  const { care_profiles, watering_events, ...plant } = data;
  const care = Array.isArray(care_profiles) ? (care_profiles[0] ?? null) : care_profiles;
  return { ...plant, care, lastWatered: watering_events?.[0]?.watered_at ?? null } as PlantDetail;
}

export async function updatePlant(
  id: string,
  fields: { nickname: string; location: string | null; notes: string | null },
) {
  const { error } = await supabase.from("plants").update(fields).eq("id", id);
  if (error) throw error;
}

export async function saveCare(plantId: string, care: CareEdit, source: "ai" | "manual") {
  const { error } = await supabase.from("care_profiles").upsert({
    plant_id: plantId,
    description: care.description,
    light: care.light,
    water_min_days: care.waterMinDays,
    water_max_days: care.waterMaxDays,
    water_notes: care.waterNotes,
    water_how: care.waterHow,
    health_signs: care.healthSigns,
    source,
  });
  if (error) throw error;
}

export async function applyIdentification(plantId: string, r: IdentifyResult) {
  const { error } = await supabase
    .from("plants")
    .update({ species_common: r.commonName, species_scientific: r.scientificName })
    .eq("id", plantId);
  if (error) throw error;
  await saveCare(plantId, r.care, "ai");
}

export async function deletePlant(id: string, photoPath: string | null) {
  const { error } = await supabase.from("plants").delete().eq("id", id);
  if (error) throw error;
  if (photoPath) await supabase.storage.from("plant-photos").remove([photoPath]);
}

export async function markWatered(plantId: string) {
  const { error } = await supabase.from("watering_events").insert({ plant_id: plantId });
  if (error) throw error;
}


