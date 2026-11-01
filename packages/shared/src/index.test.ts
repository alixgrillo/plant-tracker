import { describe, it, expect } from "vitest";
import { identifyRequestSchema, identifyResultSchema, classifyLight, summarizePlants } from "./index.js";

describe("identifyRequestSchema", () => {
  it("requires imagePath or name", () => {
    expect(identifyRequestSchema.safeParse({}).success).toBe(false);
    expect(identifyRequestSchema.safeParse({ name: "Pothos" }).success).toBe(true);
  });
});

describe("identifyResultSchema self-watering recommendation", () => {
  const result = {
    commonName: "Pothos",
    scientificName: "Epipremnum aureum",
    confidence: "high",
    care: {
      description: "",
      light: "",
      waterMinDays: 7,
      waterMaxDays: 10,
      waterNotes: "",
      healthSigns: "",
    },
  };

  it("defaults omitted AI recommendation fields to depends", () => {
    const parsed = identifyResultSchema.parse(result);
    expect(parsed.care.selfWateringPotRecommendation).toBe("depends");
    expect(parsed.care.selfWateringPotNotes).toBe("");
  });

  it("accepts only supported recommendation values", () => {
    expect(
      identifyResultSchema.safeParse({
        ...result,
        care: { ...result.care, selfWateringPotRecommendation: "recommended" },
      }).success,
    ).toBe(true);
    expect(
      identifyResultSchema.safeParse({
        ...result,
        care: { ...result.care, selfWateringPotRecommendation: "sometimes" },
      }).success,
    ).toBe(false);
  });
});

describe("summarizePlants", () => {
  const now = new Date(2026, 10, 10, 12);
  const day = (n: number) => new Date(2026, 10, n, 9);

  it("buckets light text", () => {
    expect(classifyLight("Bright, indirect light")).toBe("bright");
    expect(classifyLight("Full sun to direct light")).toBe("direct");
    expect(classifyLight("Low to medium light")).toBe("low");
    expect(classifyLight("Medium indirect light")).toBe("bright");
    expect(classifyLight("")).toBe("unknown");
  });

  it("counts plants, light, fertilizer types and overdue tasks", () => {
    const s = summarizePlants(
      [
        { light: "Bright indirect", fertilizerType: "Balanced liquid" },
        { light: "Low light", fertilizerType: " balanced liquid " },
        { light: null, fertilizerType: "" },
      ],
      [
        { plantId: "a", kind: "water", due: day(8) },
        { plantId: "a", kind: "fertilizer", due: day(9) },
        { plantId: "b", kind: "water", due: day(10) },
        { plantId: "c", kind: "water", due: day(12) },
        { plantId: "c", kind: "fertilizer", due: null },
      ],
      now,
    );
    expect(s.total).toBe(3);
    expect(s.byLight).toEqual({ low: 1, medium: 0, bright: 1, direct: 0, unknown: 1 });
    expect(s.fertilizers).toEqual([{ type: "Balanced liquid", count: 2 }]);
    expect(s.overdue).toEqual({ plants: 1, watering: 1, fertilizing: 1 });
  });
});

import { careEditSchema } from "./index.js";

describe("careEditSchema", () => {
  const base = { description: "", light: "", waterNotes: "", healthSigns: "" };
  it("requires min <= max", () => {
    expect(careEditSchema.safeParse({ ...base, waterMinDays: 10, waterMaxDays: 5 }).success).toBe(false);
    expect(careEditSchema.safeParse({ ...base, waterMinDays: 5, waterMaxDays: 10 }).success).toBe(true);
  });
});

import { nextFertilizerDue, nextWaterDue, wateringIntervalDays, toDateKey } from "./index.js";

describe("nextWaterDue", () => {
  const created = new Date("2026-01-01T12:00:00Z");
  const care = { waterMinDays: 6, waterMaxDays: 10 };
  it("uses the midpoint of min/max from the creation date when never watered", () => {
    expect(nextWaterDue(null, created, care, null)?.toISOString()).toBe("2026-01-09T12:00:00.000Z");
  });

  describe("nextFertilizerDue", () => {
    const created = new Date("2026-01-01T12:00:00Z");
    it("uses the last fertilizing event or creation date to schedule the next one", () => {
      expect(nextFertilizerDue(null, created, 30)?.toISOString()).toBe("2026-01-31T12:00:00.000Z");
      const last = new Date("2026-02-01T12:00:00Z");
      expect(nextFertilizerDue(last, created, 30)?.toISOString()).toBe("2026-03-03T12:00:00.000Z");
    });

    it("returns no reminder when regular fertilizing is not recommended", () => {
      expect(nextFertilizerDue(null, created, null)).toBeNull();
    });
  });
  it("uses the last watering when present", () => {
    const last = new Date("2026-01-20T12:00:00Z");
    expect(nextWaterDue(last, created, care, null)?.toISOString()).toBe("2026-01-28T12:00:00.000Z");
  });
  it("prefers the user override", () => {
    expect(wateringIntervalDays(care, 3)).toBe(3);
    expect(nextWaterDue(null, created, care, 3)?.toISOString()).toBe("2026-01-04T12:00:00.000Z");
  });
  it("returns null without care info or override", () => {
    expect(nextWaterDue(null, created, null, null)).toBeNull();
  });
  it("formats local date keys", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
