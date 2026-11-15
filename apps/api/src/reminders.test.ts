import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  listSchedule: vi.fn(),
  permissions: vi.fn(),
  requestPermissions: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: mocks.getItem, setItem: mocks.setItem },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: mocks.permissions,
  requestPermissionsAsync: mocks.requestPermissions,
  cancelAllScheduledNotificationsAsync: mocks.cancel,
  scheduleNotificationAsync: mocks.schedule,
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
vi.mock("../../mobile/src/lib/plants", () => ({ listSchedule: mocks.listSchedule }));

import { clearReminders, getReminderTime, setReminderTime, syncReminders } from "../../mobile/src/lib/reminders.js";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  mocks.getItem.mockResolvedValue(null);
  mocks.setItem.mockResolvedValue(undefined);
  mocks.permissions.mockResolvedValue({ granted: true });
  mocks.cancel.mockResolvedValue(undefined);
  mocks.schedule.mockResolvedValue("id");
  mocks.listSchedule.mockResolvedValue([]);
});

describe("reminder settings and scheduling", () => {
  it("persists and validates the time with a safe default", async () => {
    expect(await getReminderTime()).toBe("09:00");
    await setReminderTime("18:30");
    expect(mocks.setItem).toHaveBeenCalledWith("plant-tracker:reminder-time", "18:30");
    mocks.getItem.mockResolvedValue("18:30");
    expect(await getReminderTime()).toBe("18:30");
    mocks.getItem.mockResolvedValue("25:00");
    expect(await getReminderTime()).toBe("09:00");
    await expect(setReminderTime("25:00")).rejects.toThrow("24-hour");
  });

  it("reschedules at the saved time and removes old follow-ups after watering", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 8));
    mocks.getItem.mockResolvedValue("18:30");
    mocks.listSchedule.mockResolvedValue([{
      id: "p:water", plantId: "p", nickname: "Fern", species_common: null,
      kind: "water", due: new Date(2026, 10, 15),
    }]);
    expect(await syncReminders()).toBe("scheduled");
    expect(mocks.schedule).toHaveBeenCalledTimes(4);
    expect(mocks.schedule.mock.calls[0][0].trigger.date.getHours()).toBe(18);
    expect(mocks.schedule.mock.calls[0][0].trigger.date.getMinutes()).toBe(30);

    mocks.listSchedule.mockResolvedValue([{
      id: "p:water", plantId: "p", nickname: "Fern", species_common: null,
      kind: "water", due: new Date(2026, 10, 22),
    }]);
    mocks.schedule.mockClear();
    await syncReminders();
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.schedule).toHaveBeenCalledTimes(4);
    expect(mocks.schedule.mock.calls[0][0].trigger.date.getDate()).toBe(22);
    vi.useRealTimers();
  });

  it("reports denied permissions without discarding existing reminders", async () => {
    mocks.permissions.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await syncReminders()).toBe("denied");
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.listSchedule).not.toHaveBeenCalled();
  });

  it("serializes sign-out cancellation after an in-progress rebuild", async () => {
    let finish!: (value: unknown[]) => void;
    mocks.listSchedule.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const sync = syncReminders();
    await vi.waitFor(() => expect(mocks.listSchedule).toHaveBeenCalled());
    const clear = clearReminders();
    finish([{
      id: "p:water", plantId: "p", nickname: "Fern", species_common: null,
      kind: "water", due: new Date(),
    }]);
    await Promise.all([sync, clear]);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.schedule).toHaveBeenCalledTimes(4);
    expect(mocks.cancel.mock.invocationCallOrder[1]).toBeGreaterThan(
      mocks.schedule.mock.invocationCallOrder[3],
    );
  });
});
