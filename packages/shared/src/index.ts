import { z } from "zod";

export const careProfileSchema = z.object({
  description: z.string(),
  light: z.string(),
  waterMinDays: z.number().int().positive(),
  waterMaxDays: z.number().int().positive(),
  waterNotes: z.string(),
  waterHow: z.string().default(""),
  fertilizerEveryDays: z.number().int().positive().nullable().default(null),
  fertilizerNotes: z.string().default(""),
  fertilizerType: z.string().default(""),
  selfWateringPotRecommendation: z.enum(["recommended", "not_recommended", "depends"]).default("depends"),
  selfWateringPotNotes: z.string().default(""),
  healthSigns: z.string(),
});
export type CareProfile = z.infer<typeof careProfileSchema>;

export const identifyResultSchema = z.object({
  commonName: z.string(),
  scientificName: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  care: careProfileSchema,
  model: z.string().optional(),
});
export type IdentifyResult = z.infer<typeof identifyResultSchema>;

export const identifyRequestSchema = z
  .object({
    imagePath: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
    quality: z.enum(["standard", "high"]).default("standard"),
    notThis: z.string().max(100).optional(),
  })
  .refine((v) => v.imagePath || v.name, { message: "imagePath or name is required" });
export type IdentifyRequest = z.infer<typeof identifyRequestSchema>;

export const plantInputSchema = z.object({
  nickname: z.string().min(1).max(100),
  speciesCommon: z.string().nullable(),
  speciesScientific: z.string().nullable(),
  photoPath: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
});
export type PlantInput = z.infer<typeof plantInputSchema>;

export const careEditSchema = z
  .object({
    description: z.string(),
    light: z.string(),
    waterMinDays: z.number().int().positive(),
    waterMaxDays: z.number().int().positive(),
    waterNotes: z.string(),
    waterHow: z.string().default(""),
    fertilizerEveryDays: z.number().int().positive().nullable().default(null),
    fertilizerNotes: z.string().default(""),
    fertilizerType: z.string().default(""),
    selfWateringPotRecommendation: z.enum(["recommended", "not_recommended", "depends"]).default("depends"),
    selfWateringPotNotes: z.string().default(""),
    healthSigns: z.string(),
  })
  .refine((v) => v.waterMinDays <= v.waterMaxDays, {
    message: "Minimum days must not exceed maximum days",
    path: ["waterMinDays"],
  });
export type CareEdit = z.infer<typeof careEditSchema>;





export const feedbackSchema = z.object({
  plantId: z.string().uuid().optional(),
  aiSpeciesCommon: z.string().max(200).optional(),
  aiSpeciesScientific: z.string().max(200).optional(),
  aiConfidence: z.enum(["low", "medium", "high"]).optional(),
  modelUsed: z.string().max(100).optional(),
  userSuggestedSpecies: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  imagePath: z.string().max(300).optional(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function wateringIntervalDays(
  care: { waterMinDays: number | null; waterMaxDays: number | null } | null,
  override: number | null,
): number | null {
  if (override && override > 0) return override;
  if (!care || care.waterMinDays == null || care.waterMaxDays == null) return null;
  return Math.max(1, Math.round((care.waterMinDays + care.waterMaxDays) / 2));
}

// Next watering = last watering (or the day the plant was added) + interval.
export function nextWaterDue(
  lastWatered: Date | null,
  createdAt: Date,
  care: { waterMinDays: number | null; waterMaxDays: number | null } | null,
  override: number | null,
): Date | null {
  const interval = wateringIntervalDays(care, override);
  if (interval == null) return null;
  const base = lastWatered ?? createdAt;
  return new Date(base.getTime() + interval * DAY_MS);
}

export function nextFertilizerDue(
  lastFertilized: Date | null,
  createdAt: Date,
  fertilizerEveryDays: number | null,
): Date | null {
  if (fertilizerEveryDays == null || fertilizerEveryDays <= 0) return null;
  const base = lastFertilized ?? createdAt;
  return new Date(base.getTime() + fertilizerEveryDays * DAY_MS);
}

export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type LightCategory = "low" | "medium" | "bright" | "direct" | "unknown";

// Care profiles store light as free text, so bucket it by keyword.
export function classifyLight(text: string | null | undefined): LightCategory {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/full sun|\bdirect\b/.test(t) && !/indirect/.test(t)) return "direct";
  if (/\blow\b|shade/.test(t)) return "low";
  if (/bright|indirect/.test(t)) return "bright";
  if (/medium|moderate|partial|filtered/.test(t)) return "medium";
  return "unknown";
}

export interface SummaryPlant {
  light: string | null;
  fertilizerType: string | null;
}

export interface SummaryTask {
  plantId: string;
  kind: "water" | "fertilizer";
  due: Date | null;
}

export interface PlantSummary {
  total: number;
  byLight: Record<LightCategory, number>;
  fertilizers: { type: string; count: number }[];
  overdue: { plants: number; watering: number; fertilizing: number };
}

export function summarizePlants(plants: SummaryPlant[], tasks: SummaryTask[], now: Date): PlantSummary {
  const byLight: Record<LightCategory, number> = { low: 0, medium: 0, bright: 0, direct: 0, unknown: 0 };
  const types = new Map<string, { type: string; count: number }>();
  for (const p of plants) {
    byLight[classifyLight(p.light)]++;
    const type = p.fertilizerType?.trim();
    if (type) {
      const key = type.toLowerCase();
      const entry = types.get(key) ?? { type, count: 0 };
      entry.count++;
      types.set(key, entry);
    }
  }

  const today = toDateKey(now);
  const overdueTasks = tasks.filter((t) => t.due && toDateKey(t.due) < today);
  return {
    total: plants.length,
    byLight,
    fertilizers: [...types.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    overdue: {
      plants: new Set(overdueTasks.map((t) => t.plantId)).size,
      watering: overdueTasks.filter((t) => t.kind === "water").length,
      fertilizing: overdueTasks.filter((t) => t.kind === "fertilizer").length,
    },
  };
}
