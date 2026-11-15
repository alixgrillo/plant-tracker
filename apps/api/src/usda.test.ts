import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupUsda, UsdaCheckedIdentifier } from "./usda.js";
import { referencePhoto } from "./reference-photos.js";

vi.mock("./reference-photos.js", () => ({ referencePhoto: vi.fn() }));

const searchResult = (name: string, symbol: string) =>
  [{ Plant: { ScientificName: `<i>${name}</i> Author`, Symbol: symbol } }];
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("USDA scientific name comparison", () => {
  it("looks up the AI name and compares it with the accepted USDA profile", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(searchResult("Epipremnum aureum", "EPAU")))
      .mockResolvedValueOnce(ok({ ScientificName: "<i>Epipremnum aureum</i> Author" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupUsda("Epipremnum aureum")).toEqual({
      status: "match", acceptedName: "Epipremnum aureum",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("searchText=Epipremnum+aureum");
    expect(String(fetchMock.mock.calls[1][0])).toContain("symbol=EPAU");
  });

  it("reports a synonym without replacing the AI guess", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok(searchResult("Abutilon americanum", "ABAM5")))
      .mockResolvedValueOnce(ok({ ScientificName: "<i>Abutilon abutiloides</i> Author" })));
    expect(await lookupUsda("Abutilon americanum")).toEqual({
      status: "synonym", acceptedName: "Abutilon abutiloides",
    });
  });

  it("does not mistake a partial search result for a match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(searchResult("Quercus rubra", "QURU"))));
    expect(await lookupUsda("Quercus alba")).toEqual({ status: "not_found" });
  });

  it("does not confuse a species with its varieties", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok([
        ...searchResult("Quercus alba", "QUAL"),
        { Plant: { ScientificName: "<i>Quercus alba</i> L. var. <i>subcaerulea</i> Author", Symbol: "QUALS" } },
      ]))
      .mockResolvedValueOnce(ok({ ScientificName: "<i>Quercus alba</i> L." })));
    expect(await lookupUsda("Quercus alba")).toEqual({ status: "match", acceptedName: "Quercus alba" });
  });

  it("distinguishes no result from an unavailable or unsupported lookup", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok([]))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(ok({ unexpected: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupUsda("Quercus alba")).toEqual({ status: "not_found" });
    expect(await lookupUsda("Quercus alba")).toEqual({ status: "unavailable" });
    expect(await lookupUsda("Quercus alba")).toEqual({ status: "unavailable" });
    expect(await lookupUsda("Quercus alba var. alba")).toEqual({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("preserves the AI result when USDA is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = {
      commonName: "Pothos", scientificName: "Epipremnum aureum", confidence: "high" as const,
      care: {
        description: "", light: "", waterMinDays: 7, waterMaxDays: 10, waterNotes: "",
        waterHow: "", fertilizerEveryDays: null, fertilizerNotes: "", fertilizerType: "",
        selfWateringPotRecommendation: "depends" as const, selfWateringPotNotes: "", healthSigns: "",
      },
    };
    const identifier = new UsdaCheckedIdentifier({ identify: async () => result });
    expect(await identifier.identify({ name: "pothos" })).toEqual({
      ...result, usda: { status: "unavailable" },
    });
  });

  it("adds reference photos only to low-confidence alternatives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const photo = {
      url: "https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg",
      attribution: "Photo by Example (CC BY)",
      sourceUrl: "https://www.inaturalist.org/photos/123",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    };
    vi.mocked(referencePhoto).mockResolvedValue(photo);
    const result = {
      commonName: "Pothos", scientificName: "Epipremnum aureum", confidence: "medium" as const,
      care: {
        description: "", light: "", waterMinDays: 7, waterMaxDays: 10, waterNotes: "",
        waterHow: "", fertilizerEveryDays: null, fertilizerNotes: "", fertilizerType: "",
        selfWateringPotRecommendation: "depends" as const, selfWateringPotNotes: "", healthSigns: "",
      },
      alternatives: [{ commonName: "Satin pothos", scientificName: "Scindapsus pictus" }],
    };
    const identifier = new UsdaCheckedIdentifier({ identify: async () => result });
    expect((await identifier.identify({ name: "pothos" })).alternatives).toEqual([
      { ...result.alternatives[0], photo },
    ]);
    vi.mocked(referencePhoto).mockClear();
    const high = new UsdaCheckedIdentifier({ identify: async () => ({ ...result, confidence: "high" as const }) });
    expect((await high.identify({ name: "pothos" })).alternatives).toEqual([]);
    expect(referencePhoto).not.toHaveBeenCalled();
  });
});
