import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { listSchedule } from "./plants";

const REMINDER_HOUR = 9;
const DAYS_AHEAD = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function summarize(items: { nickname: string; kind: "water" | "fertilizer" }[]) {
  const water = items.filter((i) => i.kind === "water").map((i) => i.nickname);
  const fert = items.filter((i) => i.kind === "fertilizer").map((i) => i.nickname);
  const parts: string[] = [];
  if (water.length) parts.push(`💧 Water: ${water.join(", ")}`);
  if (fert.length) parts.push(`🌿 Fertilize: ${fert.join(", ")}`);
  return parts.join("\n");
}

// Rebuilds all local reminders from the current schedule. Safe to call often.
export async function syncReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("care", {
      name: "Plant care",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const items = await listSchedule();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const first = new Date(now);
  first.setHours(REMINDER_HOUR, 0, 0, 0);
  if (first <= now) first.setDate(first.getDate() + 1);
  const last = new Date(first);
  last.setDate(last.getDate() + DAYS_AHEAD);

  // Overdue tasks are rolled into the next reminder; later tasks go on their due day.
  const byDay = new Map<string, { at: Date; items: typeof items }>();
  for (const item of items) {
    if (!item.due) continue;
    let at = new Date(item.due);
    at.setHours(REMINDER_HOUR, 0, 0, 0);
    if (at < first) at = first;
    if (at >= last) continue;
    const k = dayKey(at);
    const entry = byDay.get(k) ?? { at, items: [] };
    entry.items.push(item);
    byDay.set(k, entry);
  }

  for (const { at, items: dayItems } of byDay.values()) {
    await Notifications.scheduleNotificationAsync({
      content: { title: "Plant care today 🪴", body: summarize(dayItems) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: "care" },
    });
  }
}
