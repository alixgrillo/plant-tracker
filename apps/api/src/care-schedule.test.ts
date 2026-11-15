import { afterEach, describe, expect, it, vi } from "vitest";
import { toDateKey } from "@plant-tracker/shared";
import { getPlant, listSchedule, markFertilized, markWatered } from "../../mobile/src/lib/plants.js";
import { supabase } from "../../mobile/src/lib/supabase.js";

vi.mock("../../mobile/src/lib/supabase.js", () => ({ supabase: { from: vi.fn() } }));

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe.each([
  { month: 10, day: 4, label: "early" },
  { month: 11, day: 20, label: "late" },
])("marking care $label", ({ month, day }) => {
  it("appends today's events and moves each due date from that day", async () => {
    vi.useFakeTimers();
    const now = new Date(2026, month, day, 12);
    vi.setSystemTime(now);
    const watered = [{ watered_at: new Date(2026, 9, 30, 12).toISOString() }];
    const fertilized = [{ fertilized_at: new Date(2026, 9, 30, 12).toISOString() }];
    const care = { water_min_days: 6, water_max_days: 10, fertilizer_every_days: 30 };
    const plant = {
      id: "p1", nickname: "Plant", species_common: null,
      created_at: new Date(2026, 8, 1, 12).toISOString(), water_interval_override: null,
    };
    const data = () => ({
      ...plant, care_profiles: care,
      watering_events: [...watered].sort((a, b) => b.watered_at.localeCompare(a.watered_at)).slice(0, 1),
      fertilizer_events: [...fertilized].sort((a, b) => b.fertilized_at.localeCompare(a.fertilized_at)).slice(0, 1),
    });
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      single: async () => ({ data: data(), error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: [data()], error: null }),
    };
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === "plants") return query;
      return {
        insert: async (value: { plant_id: string }) => {
          expect(value).toEqual({ plant_id: "p1" });
          if (table === "watering_events") watered.push({ watered_at: new Date().toISOString() });
          if (table === "fertilizer_events") fertilized.push({ fertilized_at: new Date().toISOString() });
          return { error: null };
        },
      };
    }) as unknown as typeof supabase.from);

    await markWatered("p1");
    await markFertilized("p1");
    const detail = await getPlant("p1");
    const schedule = await listSchedule();
    const waterDue = new Date(now);
    waterDue.setDate(waterDue.getDate() + 8);
    const fertilizerDue = new Date(now);
    fertilizerDue.setDate(fertilizerDue.getDate() + 30);
    expect(detail.lastWatered).toBe(now.toISOString());
    expect(detail.lastFertilized).toBe(now.toISOString());
    expect(toDateKey(schedule.find((item) => item.kind === "water")!.due!)).toBe(toDateKey(waterDue));
    expect(toDateKey(schedule.find((item) => item.kind === "fertilizer")!.due!)).toBe(toDateKey(fertilizerDue));
    expect(watered).toHaveLength(2);
    expect(fertilized).toHaveLength(2);
    expect(care).toEqual({ water_min_days: 6, water_max_days: 10, fertilizer_every_days: 30 });
  });
});
