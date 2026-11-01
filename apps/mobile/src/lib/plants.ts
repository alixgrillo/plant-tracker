import {
  nextFertilizerDue,
  nextWaterDue,
  summarizePlants,
  type CareEdit,
  type IdentifyResult,
  type PlantSummary,
} from "@plant-tracker/shared";
import { supabase } from "./supabase";

export interface PlantDetail {
  id: string;
  nickname: string;
  species_common: string | null;
  species_scientific: string | null;
  photo_path: string | null;
  location: string | null;
  notes: string | null;
  water_interval_override: number | null;
  created_at: string;
  care: {
    description: string | null;
    light: string | null;
    water_min_days: number | null;
    water_max_days: number | null;
    water_notes: string | null;
    water_how: string | null;
    fertilizer_every_days: number | null;
    fertilizer_notes: string | null;
    fertilizer_type: string | null;
    self_watering_pot_recommendation: "recommended" | "not_recommended" | "depends";
    self_watering_pot_notes: string | null;
    health_signs: string | null;
    source: "ai" | "manual";
    ai_confidence: "low" | "medium" | "high" | null;
    ai_model: string | null;
  } | null;
  lastWatered: string | null;
  lastFertilized: string | null;
}

export async function getPlant(id: string): Promise<PlantDetail> {
  const { data, error } = await supabase
    .from("plants")
    .select("*, care_profiles(*), watering_events(watered_at), fertilizer_events(fertilized_at)")
    .eq("id", id)
    .order("watered_at", { referencedTable: "watering_events", ascending: false })
    .limit(1, { referencedTable: "watering_events" })
    .order("fertilized_at", { referencedTable: "fertilizer_events", ascending: false })
    .limit(1, { referencedTable: "fertilizer_events" })
    .single();
  if (error) throw error;
  const { care_profiles, watering_events, fertilizer_events, ...plant } = data;
  const care = Array.isArray(care_profiles) ? (care_profiles[0] ?? null) : care_profiles;
  return {
    ...plant,
    care,
    lastWatered: watering_events?.[0]?.watered_at ?? null,
    lastFertilized: fertilizer_events?.[0]?.fertilized_at ?? null,
  } as PlantDetail;
}

export async function updatePlant(
  id: string,
  fields: {
    nickname: string;
    location: string | null;
    notes: string | null;
    water_interval_override: number | null;
  },
) {
  const { error } = await supabase.from("plants").update(fields).eq("id", id);
  if (error) throw error;
}

export async function saveCare(
  plantId: string,
  care: CareEdit,
  source: "ai" | "manual",
  ai?: { confidence: "low" | "medium" | "high"; model?: string },
) {
  const { error } = await supabase.from("care_profiles").upsert({
    plant_id: plantId,
    description: care.description,
    light: care.light,
    water_min_days: care.waterMinDays,
    water_max_days: care.waterMaxDays,
    water_notes: care.waterNotes,
    water_how: care.waterHow,
    fertilizer_every_days: care.fertilizerEveryDays,
    fertilizer_notes: care.fertilizerNotes,
    fertilizer_type: care.fertilizerType,
    self_watering_pot_recommendation: care.selfWateringPotRecommendation,
    self_watering_pot_notes: care.selfWateringPotNotes,
    health_signs: care.healthSigns,
    source,
    ai_confidence: source === "ai" ? (ai?.confidence ?? null) : null,
    ai_model: source === "ai" ? (ai?.model ?? null) : null,
  });
  if (error) throw error;
}

export async function applyIdentification(plantId: string, r: IdentifyResult) {
  const { error } = await supabase
    .from("plants")
    .update({ species_common: r.commonName, species_scientific: r.scientificName })
    .eq("id", plantId);
  if (error) throw error;
  await saveCare(plantId, r.care, "ai", { confidence: r.confidence, model: r.model });
}

export async function deletePlant(id: string, photoPath: string | null) {
  const { error } = await supabase.from("plants").delete().eq("id", id);
  if (error) throw error;
  if (photoPath) await supabase.storage.from("plant-photos").remove([photoPath]);
}

export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("plant-photos").createSignedUrls(paths, 3600);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}

export async function markWatered(plantId: string) {
  const { error } = await supabase.from("watering_events").insert({ plant_id: plantId });
  if (error) throw error;
}

export async function markFertilized(plantId: string) {
  const { error } = await supabase.from("fertilizer_events").insert({ plant_id: plantId });
  if (error) throw error;
}






export interface ScheduleItem {
  id: string;
  plantId: string;
  nickname: string;
  species_common: string | null;
  kind: "water" | "fertilizer";
  due: Date | null;
}

export async function listSchedule(): Promise<ScheduleItem[]> {
  const { data, error } = await supabase
    .from("plants")
    .select(
      "id, nickname, species_common, created_at, water_interval_override, care_profiles(water_min_days, water_max_days, fertilizer_every_days), watering_events(watered_at), fertilizer_events(fertilized_at)",
    )
    .order("watered_at", { referencedTable: "watering_events", ascending: false })
    .limit(1, { referencedTable: "watering_events" })
    .order("fertilized_at", { referencedTable: "fertilizer_events", ascending: false })
    .limit(1, { referencedTable: "fertilizer_events" });
  if (error) throw error;
  return (data ?? []).flatMap((p) => {
    const cp = Array.isArray(p.care_profiles) ? p.care_profiles[0] : p.care_profiles;
    const last = p.watering_events?.[0]?.watered_at;
    const lastFertilized = p.fertilizer_events?.[0]?.fertilized_at;
    const waterDue = nextWaterDue(
      last ? new Date(last) : null,
      new Date(p.created_at),
      cp ? { waterMinDays: cp.water_min_days, waterMaxDays: cp.water_max_days } : null,
      p.water_interval_override,
    );
    const fertilizerDue = nextFertilizerDue(
      lastFertilized ? new Date(lastFertilized) : null,
      new Date(p.created_at),
      cp?.fertilizer_every_days ?? null,
    );
    const items: ScheduleItem[] = [
      { id: `${p.id}:water`, plantId: p.id, nickname: p.nickname, species_common: p.species_common, kind: "water", due: waterDue },
    ];
    if (fertilizerDue) items.push({ id: `${p.id}:fertilizer`, plantId: p.id, nickname: p.nickname, species_common: p.species_common, kind: "fertilizer", due: fertilizerDue });
    return items;
  });
}

export async function loadSummary(): Promise<PlantSummary> {
  const [{ data, error }, schedule] = await Promise.all([
    supabase.from("plants").select("id, care_profiles(light, fertilizer_type)"),
    listSchedule(),
  ]);
  if (error) throw error;
  const plants = (data ?? []).map((p) => {
    const cp = Array.isArray(p.care_profiles) ? p.care_profiles[0] : p.care_profiles;
    return { light: cp?.light ?? null, fertilizerType: cp?.fertilizer_type ?? null };
  });
  return summarizePlants(plants, schedule, new Date());
}
