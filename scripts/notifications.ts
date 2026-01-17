import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Call once, at module load: OK.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BRIEFING_NOTIFICATION_ID_KEY = "briefing_notification_id";

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
  const id = await AsyncStorage.getItem(BRIEFING_NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(BRIEFING_NOTIFICATION_ID_KEY);
  }
}

export async function scheduleDailyBriefing(hour: number, minute: number) {
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
