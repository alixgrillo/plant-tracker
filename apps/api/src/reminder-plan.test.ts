import { describe, expect, it } from "vitest";
import { parseReminderTime, planReminders } from "../../mobile/src/lib/reminder-plan.js";
import type { ScheduleItem } from "../../mobile/src/lib/plants.js";

const item = (name: string, kind: ScheduleItem["kind"], due: Date | null): ScheduleItem => ({
  id: `${name}:${kind}`, plantId: name, nickname: name, species_common: null, kind, due,
});

describe("reminder planning", () => {
  it("accepts only valid 24-hour times", () => {
    expect(parseReminderTime(" 18:30 ")).toEqual({ hour: 18, minute: 30 });
    expect(parseReminderTime("00:00")).toEqual({ hour: 0, minute: 0 });
    for (const invalid of ["9:00", "24:00", "12:60", "", "noon"]) {
      expect(parseReminderTime(invalid)).toBeNull();
    }
  });

  it("groups care and escalates watering for three days at the chosen time", () => {
    const now = new Date(2026, 10, 15, 8);
    const result = planReminders([
      item("Fern", "water", new Date(2026, 10, 16, 23)),
      item("Fern", "fertilizer", new Date(2026, 10, 16, 12)),
      item("Unknown", "water", null),
    ], "18:30", now);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.at.getDate())).toEqual([16, 17, 18, 19]);
    expect(result.every((r) => r.at.getHours() === 18 && r.at.getMinutes() === 30)).toBe(true);
    expect(result[0].body).toContain("Water due: Fern");
    expect(result[0].body).toContain("Fertilize: Fern");
    expect(result[1].title).toContain("overdue");
    expect(result[1].body).toContain("Fern (1 day)");
    expect(result[2].title).toContain("needs attention");
    expect(result[3].body).toContain("Fern (3 days)");
    expect(result[3].body).toContain("Check soil");
  });

  it("starts overdue reminders at the next available time and keeps the original overdue date", () => {
    const now = new Date(2026, 10, 15, 20);
    const result = planReminders([item("Fern", "water", new Date(2026, 10, 12))], "18:30", now);
    expect(result).toHaveLength(4);
    expect(result[0].at.getDate()).toBe(16);
    expect(result[0].body).toContain("Fern (4 days)");
    expect(result[3].body).toContain("Fern (7 days)");
  });

  it("limits the horizon to 30 grouped notifications and clears old follow-ups when watered", () => {
    const now = new Date(2026, 10, 1, 8);
    const items = Array.from({ length: 40 }, (_, i) =>
      item(`Plant ${i}`, "water", new Date(2026, 10, 1 + i)));
    const reminders = planReminders(items, "09:00", now);
    expect(reminders).toHaveLength(30);
    const watered = planReminders([item("Fern", "water", new Date(2026, 10, 8))], "09:00", now);
    expect(watered[0].at.getDate()).toBe(8);
    expect(watered).toHaveLength(4);
  });

  it("keeps local reminder time and calendar-day overdue counts across daylight saving", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const reminders = planReminders(
        [item("Fern", "water", new Date(2026, 2, 7, 12))],
        "09:30",
        new Date(2026, 2, 7, 8),
      );
      expect(reminders.map((r) => r.at.getHours())).toEqual([9, 9, 9, 9]);
      expect(reminders[1].body).toContain("Fern (1 day)");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
