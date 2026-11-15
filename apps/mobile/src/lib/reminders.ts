import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { listSchedule } from "./plants";
import { DEFAULT_REMINDER_TIME, parseReminderTime, planReminders } from "./reminder-plan";

const TIME_KEY = "plant-tracker:reminder-time";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getReminderTime(): Promise<string> {
  const value = await AsyncStorage.getItem(TIME_KEY);
  return value && parseReminderTime(value) ? value : DEFAULT_REMINDER_TIME;
}

export async function setReminderTime(value: string): Promise<void> {
  if (!parseReminderTime(value)) throw new Error("Enter a time in 24-hour HH:MM format.");
  await AsyncStorage.setItem(TIME_KEY, value.trim());
}

let pending: Promise<void> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.then(() => undefined, () => undefined);
  return next;
}

export function clearReminders(): Promise<void> {
  return enqueue(async () => {
    if (Platform.OS !== "web") await Notifications.cancelAllScheduledNotificationsAsync();
  });
}

// Serialize rebuilds so an older schedule cannot overwrite a newer one.
export function syncReminders(): Promise<"scheduled" | "denied" | "unsupported"> {
  return enqueue(async () => {
    if (Platform.OS === "web") return "unsupported";
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return "denied";

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("care", {
        name: "Plant care",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const [items, time] = await Promise.all([listSchedule(), getReminderTime()]);
    const reminders = planReminders(items, time, new Date());
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: "care" },
      });
    }
    return "scheduled";
  });
}
