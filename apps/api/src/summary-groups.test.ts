import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSummary } from "../../mobile/src/lib/plants.js";
import { supabase } from "../../mobile/src/lib/supabase.js";

vi.mock("../../mobile/src/lib/supabase.js", () => ({ supabase: { from: vi.fn() } }));

afterEach(() => vi.resetAllMocks());

describe("summary plant groups", () => {
  it("uses plant identities and handles absent and array-shaped care profiles", async () => {
    const records = [
      { id: "p1", nickname: "Aloe", care_profiles: [{ light: "Direct sun", fertilizer_type: "Cactus feed" }] },
      { id: "p2", nickname: "Fern", care_profiles: null },
      { id: "p3", nickname: "Zebra", care_profiles: { light: "direct", fertilizer_type: " cactus feed " } },
    ];
    const scheduleRecords = records.map((p) => ({
      ...p, species_common: null, created_at: "2026-01-01T00:00:00Z",
      water_interval_override: null, watering_events: [], fertilizer_events: [],
    }));
    const selects: string[] = [];
    vi.mocked(supabase.from).mockImplementation((() => ({
      select: (columns: string) => {
        selects.push(columns);
        const query = {
          order: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => void) => resolve({
            data: columns.includes("watering_events") ? scheduleRecords : records, error: null,
          }),
        };
        return query;
      },
    })) as unknown as typeof supabase.from);

    const result = await loadSummary();
    expect(selects.some((columns) => columns.includes("id, nickname, care_profiles"))).toBe(true);
    expect(result.byLight.direct).toBe(2);
    expect(result.plantsByLight.direct.map((p) => p.nickname)).toEqual(["Aloe", "Zebra"]);
    expect(result.plantsByLight.unknown.map((p) => p.id)).toEqual(["p2"]);
    expect(result.fertilizers[0].plants.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(result.fertilizers[0].count).toBe(2);
  });
});
