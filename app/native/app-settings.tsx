import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  useColorScheme,
  Alert,
  AppState,
  Platform,
} from "react-native";
import { NativeHeader } from "@/components/NativeHeader";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BRIEFING_ENABLED_KEY,
  BRIEFING_TIME_KEY,
  cancelDailyBriefing,
  scheduleDailyBriefing,
} from "@/scripts/notifications";
import { refreshTaskPlayer } from "@/scripts/taskPlayer";
import TaskPlayer from "@/modules/task-player";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function PushSettings() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const c = palette(isDark);

  // default 08:00
  const [time, setTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });

  const [enabled, setEnabled] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Alarms & reminders": only asked for where Android requires it
  const [exactAlarms, setExactAlarms] = useState(
    () => TaskPlayer?.canScheduleExactAlarms() ?? true,
  );

  // The switch lives in the system settings: re-check on return
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || !TaskPlayer) return;
      const allowed = TaskPlayer.canScheduleExactAlarms();
      setExactAlarms((before) => {
        // Reschedule a pending timer alert so it rings exactly now
        if (allowed && !before) refreshTaskPlayer();
        return allowed;
      });
    });
    return () => sub.remove();
  }, []);

  const timeLabel = useMemo(() => {
    const hh = pad2(time.getHours());
    const mm = pad2(time.getMinutes());
    return `${hh}:${mm}`;
  }, [time]);

  // load saved state
  useEffect(() => {
    (async () => {
      const savedTime = await AsyncStorage.getItem(BRIEFING_TIME_KEY);
      const savedEnabled = await AsyncStorage.getItem(BRIEFING_ENABLED_KEY);

      if (savedTime) {
        const [hh, mm] = savedTime.split(":").map((x) => parseInt(x, 10));
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
          const d = new Date();
          d.setHours(hh, mm, 0, 0);
          setTime(d);
        }
      }

      setEnabled(savedEnabled === "true");
    })();
  }, []);

  const persistTime = async (d: Date) => {
    const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    await AsyncStorage.setItem(BRIEFING_TIME_KEY, hhmm);
  };

  const persistEnabled = async (v: boolean) => {
    await AsyncStorage.setItem(BRIEFING_ENABLED_KEY, v ? "true" : "false");
  };

  const applySchedule = async (newEnabled: boolean, newTime: Date) => {
    setBusy(true);
    try {
      if (!newEnabled) {
        await cancelDailyBriefing();
        await persistEnabled(false);
        setEnabled(false);
        return;
      }

      const res = await scheduleDailyBriefing(
        newTime.getHours(),
        newTime.getMinutes(),
      );
      if (!res.ok) {
        Alert.alert(
          "Notifications disabled",
          "Please enable notifications in your system settings.",
        );
        await persistEnabled(false);
        setEnabled(false);
        return;
      }

      await persistEnabled(true);
      setEnabled(true);
    } finally {
      setBusy(false);
      // Today's progress notification follows the briefing setting
      refreshTaskPlayer();
    }
  };

  const onPickTime = async (event: any, selected?: Date) => {
    // Android fires "dismissed" when closed
    if (Platform.OS === "android") setShowPicker(false);
    if (!selected) return;

    const d = new Date(time);
    d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setTime(d);
    await persistTime(d);

    // if enabled, reschedule with new time
    if (enabled) {
      await applySchedule(true, d);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <NativeHeader title="App Settings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 15 }}>
        {/* Same look as the web settings page (MainSettings): a list of
            rows with the label on the left and the control on the right */}
        <View
          style={{
            paddingHorizontal: 15,
            paddingVertical: 5,
            borderRadius: 20,
            backgroundColor: c.bg,
          }}
        >
          <SettingsRow
            c={c}
            label="Daily briefing"
            description="Get a daily notification at the time you choose."
            disabled={busy}
            onPress={() => applySchedule(!enabled, time)}
            right={
              <DaexSwitch
                c={c}
                checked={enabled}
                disabled={busy}
                onPress={() => applySchedule(!enabled, time)}
              />
            }
          />
          <SettingsRow
            c={c}
            showDivider
            label="Briefing time"
            description="When the daily briefing arrives."
            onPress={() => setShowPicker(true)}
            right={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 15, color: c.muted }}>
                  {timeLabel}
                </Text>
                <Text
                  style={{ fontSize: 24, lineHeight: 26, color: c.chevron }}
                >
                  ›
                </Text>
              </View>
            }
          />

          {showPicker && (
            <View style={{ paddingBottom: 10 }}>
              <DateTimePicker
                mode="time"
                value={time}
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onPickTime}
              />
              {/* The iOS spinner stays open until closed explicitly */}
              {Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setShowPicker(false)}
                  hitSlop={10}
                  style={{ alignSelf: "flex-end", paddingVertical: 6 }}
                >
                  <Text style={{ fontWeight: "600", color: c.accent }}>
                    Done
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {Platform.OS === "android" && TaskPlayer && (
            <SettingsRow
              c={c}
              showDivider
              label="Exact timer alerts"
              description={
                exactAlarms
                  ? "Pomodoro alerts ring right on time."
                  : "Allow \"Alarms & reminders\" so Pomodoro alerts aren't late while the phone is in standby."
              }
              onPress={() => TaskPlayer?.openExactAlarmSettings()}
              right={
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: exactAlarms ? c.muted : c.accent,
                      fontWeight: exactAlarms ? "400" : "600",
                    }}
                  >
                    {exactAlarms ? "On" : "Allow"}
                  </Text>
                  <Text
                    style={{ fontSize: 24, lineHeight: 26, color: c.chevron }}
                  >
                    ›
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type Palette = ReturnType<typeof palette>;

// Values of the web color tokens (daex-frontend colors.module.scss)
function palette(isDark: boolean) {
  return isDark
    ? {
        page: "#414141", // --color__grey150
        bg: "#111111", // --color__white
        text: "#ffffff", // --color__black
        muted: "#d0d0d0", // --color__grey700
        divider: "#686868", // --color__grey200
        chevron: "#9c9c9c", // --color__grey400
        accent: "#8fd49c", // --color__green500
      }
    : {
        page: "#f8f8f8",
        bg: "#ffffff",
        text: "#000000",
        muted: "#5a5a5a",
        divider: "#e5e5e5",
        chevron: "#ababab",
        accent: "#79bc5c",
      };
}

/** One setting per row, like SettingsToggleRow / SettingsLinkRow on the web */
function SettingsRow({
  c,
  label,
  description,
  right,
  onPress,
  disabled,
  showDivider,
}: {
  c: Palette;
  label: string;
  description?: string;
  right: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showDivider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 48,
        paddingVertical: 10,
        borderTopWidth: showDivider ? 1 : 0,
        borderTopColor: c.divider,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, color: c.text }}>{label}</Text>
        {description && (
          <Text style={{ fontSize: 13.5, color: c.muted }}>{description}</Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

/** Same switch as DaexToggle on the web: 48×28 track, 22px handle */
function DaexSwitch({
  c,
  checked,
  disabled,
  onPress,
}: {
  c: Palette;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(checked ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 150,
      easing: Easing.ease,
      // Color can't be animated natively
      useNativeDriver: false,
    }).start();
  }, [checked, progress]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
    >
      <Animated.View
        style={{
          width: 48,
          height: 28,
          padding: 3,
          borderRadius: 14,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [c.chevron, c.accent],
          }),
        }}
      >
        <Animated.View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#ffffff",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
            ],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
