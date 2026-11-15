import { describe, expect, it, vi } from "vitest";
import type { IdentifyResult } from "@plant-tracker/shared";
import { chooseAlternative } from "../../mobile/src/lib/alternatives.js";
import { identifyPlant } from "../../mobile/src/lib/api.js";

vi.mock("../../mobile/src/lib/api.js", () => ({ identifyPlant: vi.fn() }));

describe("choosing a lookalike", () => {
  it("loads the selected species' care and retains other options", async () => {
    const care = {
      description: "", light: "", waterMinDays: 7, waterMaxDays: 10, waterNotes: "",
      waterHow: "", fertilizerEveryDays: null, fertilizerNotes: "", fertilizerType: "",
      selfWateringPotRecommendation: "depends" as const, selfWateringPotNotes: "", healthSigns: "",
    };
    const choice = { commonName: "Satin", scientificName: "Scindapsus pictus" };
    const current: IdentifyResult = {
      commonName: "Pothos", scientificName: "Epipremnum aureum", confidence: "medium", care,
      alternatives: [choice, { commonName: "Heartleaf", scientificName: "Philodendron hederaceum" }],
    };
    vi.mocked(identifyPlant).mockResolvedValue({
      ...choice, confidence: "low", care: { ...care, description: "Selected species care" },
    });
    const result = await chooseAlternative(current, choice);
    expect(identifyPlant).toHaveBeenCalledWith({ selectedScientificName: "Scindapsus pictus" });
    expect(result.care.description).toBe("Selected species care");
    expect(result.alternatives).toEqual([
      { commonName: "Pothos", scientificName: "Epipremnum aureum" },
      { commonName: "Heartleaf", scientificName: "Philodendron hederaceum" },
    ]);
  });
});
