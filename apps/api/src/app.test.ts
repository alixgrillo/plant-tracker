import { afterEach, describe, it, expect, vi } from "vitest";
import { identifyResultSchema } from "@plant-tracker/shared";
import { buildApp } from "./app.js";
import { UsdaCheckedIdentifier } from "./usda.js";

afterEach(() => vi.unstubAllGlobals());

const result = {
  commonName: "Pothos",
  scientificName: "Epipremnum aureum",
  confidence: "high" as const,
  care: { description: "d", light: "indirect", waterMinDays: 7, waterMaxDays: 10, waterNotes: "n", waterHow: "Soak until it drains.", fertilizerEveryDays: null, fertilizerNotes: "", fertilizerType: "", selfWateringPotRecommendation: "depends" as const, selfWateringPotNotes: "", healthSigns: "h" },
};

const make = (over: Partial<Parameters<typeof buildApp>[0]> = {}) =>
  buildApp({
    identifier: { identify: async () => result },
    verifyToken: async (t) => (t === "good" ? "user1" : null),
    signedImageUrl: async () => "https://example.com/img.jpg",
    saveFeedback: async () => {},
    notifyOwner: async () => {},
    ...over,
  });

const auth = { authorization: "Bearer good" };

describe("POST /identify", () => {
  it("rejects missing auth", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", payload: { name: "x" } });
    expect(res.statusCode).toBe(401);
  });
  it("returns result by name", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", headers: auth, payload: { name: "pothos" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().commonName).toBe("Pothos");
  });
  it("accepts a duplicate slash from older clients while still requiring authentication", async () => {
    const app = await make();
    const unauthenticated = await app.inject({ method: "POST", url: "//identify", payload: { name: "pothos" } });
    expect(unauthenticated.statusCode).toBe(401);
    const res = await app.inject({ method: "POST", url: "//identify", headers: auth, payload: { name: "pothos" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().commonName).toBe("Pothos");
  });
  it("returns the USDA comparison alongside the AI result", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { Plant: { ScientificName: "<i>Epipremnum aureum</i> Author", Symbol: "EPAU" } },
      ])))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ScientificName: "<i>Epipremnum pinnatum</i> Author",
      }))));
    const app = await make({
      identifier: new UsdaCheckedIdentifier({ identify: async () => result }),
    });
    const res = await app.inject({ method: "POST", url: "/identify", headers: auth, payload: { name: "pothos" } });
    expect(res.statusCode).toBe(200);
    expect(identifyResultSchema.parse(res.json()).usda).toEqual({
      status: "synonym", acceptedName: "Epipremnum pinnatum",
    });
  });
  it("blocks other users' images", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", headers: auth, payload: { imagePath: "user2/a.jpg" } });
    expect(res.statusCode).toBe(403);
  });
  it("passes quality and notThis through and caps high-quality runs", async () => {
    const identify = vi.fn(async () => result);
    const app = await make({ identifier: { identify }, highQualityDailyCap: 1 });
    const payload = { imagePath: "user1/a.jpg", quality: "high", notThis: "Pothos" };
    const first = await app.inject({ method: "POST", url: "/identify", headers: auth, payload });
    expect(first.statusCode).toBe(200);
    expect(identify).toHaveBeenCalledWith(expect.objectContaining({ quality: "high", notThis: "Pothos" }));
    const second = await app.inject({ method: "POST", url: "/identify", headers: auth, payload });
    expect(second.statusCode).toBe(429);
  });
  it("passes a user-selected alternative to the identifier", async () => {
    const identify = vi.fn(async () => result);
    const app = await make({ identifier: { identify } });
    const res = await app.inject({
      method: "POST", url: "/identify", headers: auth,
      payload: { selectedScientificName: "Scindapsus pictus" },
    });
    expect(res.statusCode).toBe(200);
    expect(identify).toHaveBeenCalledWith(expect.objectContaining({ selectedScientificName: "Scindapsus pictus" }));
  });
});

describe("POST /feedback", () => {
  it("rejects missing auth", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/feedback", payload: {} });
    expect(res.statusCode).toBe(401);
  });
  it("saves feedback and notifies the owner", async () => {
    const saveFeedback = vi.fn(async () => {});
    const notifyOwner = vi.fn(async () => {});
    const app = await make({ saveFeedback, notifyOwner });
    const res = await app.inject({ method: "POST", url: "/feedback", headers: auth, payload: { aiSpeciesCommon: "Pothos", note: "looks like a philodendron" } });
    expect(res.statusCode).toBe(200);
    expect(saveFeedback).toHaveBeenCalledWith("user1", expect.objectContaining({ note: "looks like a philodendron" }));
    expect(notifyOwner).toHaveBeenCalled();
  });
  it("still succeeds if the email fails", async () => {
    const app = await make({ notifyOwner: async () => { throw new Error("smtp down"); } });
    const res = await app.inject({ method: "POST", url: "/feedback", headers: auth, payload: { note: "x" } });
    expect(res.statusCode).toBe(200);
  });
  it("blocks other users' image paths", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/feedback", headers: auth, payload: { imagePath: "user2/a.jpg" } });
    expect(res.statusCode).toBe(403);
  });
});
