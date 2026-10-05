import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TaskPlayer, { TaskPlayerState } from "@/modules/task-player";
import {
  BRIEFING_ENABLED_KEY,
  Notifications,
  requestNotificationPermission,
} from "@/scripts/notifications";

// Saved, so an alert scheduled before an app restart can still be cancelled
const TIMER_ALERT_ID_KEY = "timer_alert_notification_id";
const TIMER_ALERT_CHANNEL = "timer_alert";

// Last state from the web app, re-applied when a setting changes
let lastState: TaskPlayerState | null = null;
let askedForPermission = false;

/**
 * Applies a task player state sent by the web app:
 * - the ongoing notification (Android): running (work / break) is always
 *   shown; nothing running (today's progress) only with the daily briefing
 *   enabled, so it doesn't come back for everyone
 * - the alert when a Pomodoro interval is over (Android and iOS)
 */
export async function applyTaskPlayerState(state: TaskPlayerState | null) {
  lastState = state;

  if (state && state.mode !== "idle" && !askedForPermission) {
    // Starting the timer is the moment notifications become useful
    askedForPermission = true;
    await requestNotificationPermission();
  }

  await scheduleTimerAlert(state);

  // Only the Android notification exists so far (iOS Live Activity follows)
  if (!TaskPlayer || Platform.OS !== "android") return;
  if (!TaskPlayer.isSupported()) return;

  const briefingEnabled =
    (await AsyncStorage.getItem(BRIEFING_ENABLED_KEY)) === "true";
  if (!state || (state.mode === "idle" && !briefingEnabled)) {
    await TaskPlayer.endAsync();
    return;
  }
  await TaskPlayer.showAsync(state);
}

export function refreshTaskPlayer() {
  return applyTaskPlayerState(lastState);
}

/** Replaces the pending "timer is up" alert with one for this state, if any */
async function scheduleTimerAlert(state: TaskPlayerState | null) {
  if (!Notifications) return;

  const previousId = await AsyncStorage.getItem(TIMER_ALERT_ID_KEY);
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
    await AsyncStorage.removeItem(TIMER_ALERT_ID_KEY);
  }

  if (!state?.alert || !state.endsAt || state.endsAt <= Date.now()) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(TIMER_ALERT_CHANNEL, {
      name: "Timer alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 400, 200, 400],
    });
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: state.alert.title,
      body: state.alert.body,
      // true = system default; a string is read as a custom sound file
      sound: true,
      data: { type: "TIMER_ALERT" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(state.endsAt),
      channelId: TIMER_ALERT_CHANNEL,
    },
  });
  await AsyncStorage.setItem(TIMER_ALERT_ID_KEY, id);
}
