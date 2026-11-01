import { describe, it, expect, vi } from "vitest";
import { buildApp } from "./app.js";

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
