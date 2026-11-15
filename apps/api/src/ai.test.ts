import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { OpenAIIdentifier } from "./ai.js";

const aiResult = {
  commonName: "Pothos", scientificName: "Epipremnum aureum", confidence: "medium",
  care: {
    description: "", light: "", waterMinDays: 7, waterMaxDays: 10, waterNotes: "", healthSigns: "",
  },
};

beforeEach(() => create.mockReset());

function respond(result: unknown) {
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(result) } }] });
}

describe("OpenAI alternatives", () => {
  it("keeps distinct plausible alternatives, discards model-supplied photos and limits the list", async () => {
    respond({
      ...aiResult,
      alternatives: [
        { commonName: "Same", scientificName: "Epipremnum aureum" },
        { commonName: "Heartleaf", scientificName: "Philodendron hederaceum", photo: { url: "https://example.com/fake" } },
        { commonName: "Duplicate", scientificName: "philodendron hederaceum" },
        { commonName: "Satin", scientificName: "Scindapsus pictus" },
        { commonName: "Other", scientificName: "Monstera adansonii" },
        { commonName: "Extra", scientificName: "Monstera deliciosa" },
      ],
    });
    const result = await new OpenAIIdentifier("key", "model").identify({ imageUrl: "https://example.com/image.jpg" });
    expect(result.alternatives).toEqual([
      { commonName: "Heartleaf", scientificName: "Philodendron hederaceum" },
      { commonName: "Satin", scientificName: "Scindapsus pictus" },
      { commonName: "Other", scientificName: "Monstera adansonii" },
    ]);
  });

  it("does not return alternatives for high-confidence identifications", async () => {
    respond({ ...aiResult, confidence: "high", alternatives: [{ commonName: "Other", scientificName: "Scindapsus pictus" }] });
    expect((await new OpenAIIdentifier("key", "model").identify({ name: "pothos" })).alternatives).toEqual([]);
  });

  it("generates care for the selected species without claiming photo confidence", async () => {
    respond({ ...aiResult, scientificName: "Scindapsus pictus", confidence: "high" });
    const identifier = new OpenAIIdentifier("key", "model");
    const result = await identifier.identify({ selectedScientificName: "Scindapsus pictus" });
    expect(result.confidence).toBe("low");
    expect(result.alternatives).toEqual([]);
    expect(create.mock.calls[0][0].messages[1].content[0].text).toContain("Scindapsus pictus");
    respond(aiResult);
    await expect(identifier.identify({ selectedScientificName: "Scindapsus pictus" })).rejects.toThrow("selected species");
  });
});
