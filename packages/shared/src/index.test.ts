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
