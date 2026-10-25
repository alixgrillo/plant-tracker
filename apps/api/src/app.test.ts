import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

const result = {
  commonName: "Pothos",
  scientificName: "Epipremnum aureum",
  confidence: "high" as const,
  care: { description: "d", light: "indirect", waterMinDays: 7, waterMaxDays: 10, waterNotes: "n", healthSigns: "h" },
};

const make = () =>
  buildApp({
    identifier: { identify: async () => result },
    verifyToken: async (t) => (t === "good" ? "user1" : null),
    signedImageUrl: async () => "https://example.com/img.jpg",
  });

describe("POST /identify", () => {
  it("rejects missing auth", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", payload: { name: "x" } });
    expect(res.statusCode).toBe(401);
  });
  it("returns result by name", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", headers: { authorization: "Bearer good" }, payload: { name: "pothos" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().commonName).toBe("Pothos");
  });
  it("blocks other users' images", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/identify", headers: { authorization: "Bearer good" }, payload: { imagePath: "user2/a.jpg" } });
    expect(res.statusCode).toBe(403);
  });
});
