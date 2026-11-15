import { toDateKey } from "@plant-tracker/shared";
import type { ScheduleItem } from "./plants";

export const DEFAULT_REMINDER_TIME = "09:00";
const DAYS_AHEAD = 30;
const WATER_FOLLOW_UP_DAYS = 3;

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

function calendarDay(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function planReminders(items: ScheduleItem[], time: string, now: Date) {
  const parsed = parseReminderTime(time) ?? parseReminderTime(DEFAULT_REMINDER_TIME)!;
  const first = new Date(now);
  first.setHours(parsed.hour, parsed.minute, 0, 0);
  if (first <= now) first.setDate(first.getDate() + 1);
  first.setHours(0, 0, 0, 0);

  const byDay = new Map<string, { at: Date; water: { name: string; overdue: number }[]; fertilizer: string[] }>();
  const dayOffset = (date: Date) => calendarDay(date) - calendarDay(first);
  for (const item of items) {
    if (!item.due || !Number.isFinite(item.due.getTime())) continue;
    const start = Math.max(0, dayOffset(item.due));
    const followUps = item.kind === "water" ? WATER_FOLLOW_UP_DAYS : 0;
    for (let offset = start; offset <= start + followUps && offset < DAYS_AHEAD; offset++) {
      const day = new Date(first);
      day.setDate(day.getDate() + offset);
      const key = toDateKey(day);
      const at = new Date(day);
      at.setHours(parsed.hour, parsed.minute, 0, 0);
      const entry = byDay.get(key) ?? { at, water: [], fertilizer: [] };
      if (item.kind === "water") {
        entry.water.push({ name: item.nickname, overdue: Math.max(0, calendarDay(day) - calendarDay(item.due)) });
      } else {
        entry.fertilizer.push(item.nickname);
      }
      byDay.set(key, entry);
    }
  }

  return [...byDay.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).map((entry) => {
    const due = entry.water.filter((water) => water.overdue === 0);
    const overdue = entry.water.filter((water) => water.overdue > 0);
    const maxOverdue = Math.max(0, ...overdue.map((water) => water.overdue));
    const parts: string[] = [];
    if (due.length) parts.push(`💧 Water due: ${due.map((water) => water.name).join(", ")}`);
    if (overdue.length) parts.push(`💧 Water overdue: ${overdue.map((water) =>
      `${water.name} (${water.overdue} day${water.overdue === 1 ? "" : "s"})`).join(", ")}`);
    if (entry.fertilizer.length) parts.push(`🌿 Fertilize: ${entry.fertilizer.join(", ")}`);
    if (entry.water.length) parts.push("Check soil and plant condition before watering.");
    return {
      at: entry.at,
      title: maxOverdue >= 2 ? "Watering needs attention 💧" : maxOverdue ? "Watering overdue 💧" : "Plant care today 🪴",
      body: parts.join("\n"),
    };
  });
}
