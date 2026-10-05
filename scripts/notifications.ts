import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";

// expo-notifications throws on import in Expo Go (Android, SDK 53+), so only load it in dev/prod builds.
// null means notifications are unavailable; callers must check before using it.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const Notifications: typeof import("expo-notifications") | null =
  isExpoGo
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("expo-notifications");

// Call once, at module load: OK.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BRIEFING_NOTIFICATION_ID_KEY = "briefing_notification_id";
export const BRIEFING_TIME_KEY = "briefing_time_hhmm";
export const BRIEFING_ENABLED_KEY = "briefing_enabled";

async function ensureAndroidChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  }
  return true;
}

export async function cancelDailyBriefing() {
  if (!Notifications) return;
  const id = await AsyncStorage.getItem(BRIEFING_NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(BRIEFING_NOTIFICATION_ID_KEY);
  }
}

export async function scheduleDailyBriefing(hour: number, minute: number) {
  if (!Notifications) return { ok: false as const };
  const ok = await requestNotificationPermission();
  if (!ok) return { ok: false as const };

  await ensureAndroidChannel();
  await cancelDailyBriefing(); // prevent duplicates

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hey 👋",
      body: "Do you want to prioritize out your tasks for today?",
      // Open the index page
      data: { type: "BRIEFING", target: "/" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(BRIEFING_NOTIFICATION_ID_KEY, id);
  return { ok: true as const, id };
}
