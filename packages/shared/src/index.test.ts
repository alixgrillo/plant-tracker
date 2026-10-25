import { describe, it, expect } from "vitest";
import { identifyRequestSchema } from "./index.js";

describe("identifyRequestSchema", () => {
  it("requires imagePath or name", () => {
    expect(identifyRequestSchema.safeParse({}).success).toBe(false);
    expect(identifyRequestSchema.safeParse({ name: "Pothos" }).success).toBe(true);
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

import { nextWaterDue, wateringIntervalDays, toDateKey } from "./index.js";

describe("nextWaterDue", () => {
  const created = new Date("2026-01-01T12:00:00Z");
  const care = { waterMinDays: 6, waterMaxDays: 10 };
  it("uses the midpoint of min/max from the creation date when never watered", () => {
    expect(nextWaterDue(null, created, care, null)?.toISOString()).toBe("2026-01-09T12:00:00.000Z");
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
