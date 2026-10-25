import { z } from "zod";

export const careProfileSchema = z.object({
  description: z.string(),
  light: z.string(),
  waterMinDays: z.number().int().positive(),
  waterMaxDays: z.number().int().positive(),
  waterNotes: z.string(),
  waterHow: z.string().default(""),
  healthSigns: z.string(),
});
export type CareProfile = z.infer<typeof careProfileSchema>;

export const identifyResultSchema = z.object({
  commonName: z.string(),
  scientificName: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  care: careProfileSchema,
});
export type IdentifyResult = z.infer<typeof identifyResultSchema>;

export const identifyRequestSchema = z
  .object({
    imagePath: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
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
    healthSigns: z.string(),
  })
  .refine((v) => v.waterMinDays <= v.waterMaxDays, {
    message: "Minimum days must not exceed maximum days",
    path: ["waterMinDays"],
  });
export type CareEdit = z.infer<typeof careEditSchema>;


