import { describe, it, expect } from "vitest";
import { identifyRequestSchema } from "./index.js";

describe("identifyRequestSchema", () => {
  it("requires imagePath or name", () => {
    expect(identifyRequestSchema.safeParse({}).success).toBe(false);
    expect(identifyRequestSchema.safeParse({ name: "Pothos" }).success).toBe(true);
  });
});
