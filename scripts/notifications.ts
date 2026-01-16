import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BRIEFING_ID_KEY = "daily_briefing_notification_id";

// Call once, at module load
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  }
  return true;
}

export async function cancelDailyBriefing() {
  const existingId = await AsyncStorage.getItem(BRIEFING_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(BRIEFING_ID_KEY);
  }
}

/**
 * Schedules a local notification every day at HH:MM (device local time).
 * Cancels any previous daily briefing first (prevents duplicates).
 */
export async function scheduleDailyBriefing(hour: number, minute: number) {
  const ok = await requestNotificationPermission();
  if (!ok) return { ok: false as const, reason: "permission_denied" as const };

  await ensureAndroidChannel();

  // prevent duplicates
  await cancelDailyBriefing();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hey 👋",
      body: "Your morning briefing is available",
      data: { type: "BRIEFING" },
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });

  await AsyncStorage.setItem(BRIEFING_ID_KEY, id);
  return { ok: true as const, id };
}
