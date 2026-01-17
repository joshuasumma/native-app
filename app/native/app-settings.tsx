import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  useColorScheme,
  Alert,
  Platform,
} from "react-native";
import { NativeHeader } from "@/components/NativeHeader";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cancelDailyBriefing,
  scheduleDailyBriefing,
} from "@/scripts/notifications";

const BRIEFING_TIME_KEY = "briefing_time_hhmm";
const BRIEFING_ENABLED_KEY = "briefing_enabled";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function PushSettings() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const bg = isDark ? "#000000" : "#ffffff";
  const text = isDark ? "#ffffff" : "#000000";
  const muted = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const card = isDark ? "#111111" : "#f6f6f6";
  const border = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";

  // default 08:00
  const [time, setTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });

  const [enabled, setEnabled] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

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
        newTime.getMinutes()
      );
      if (!res.ok) {
        Alert.alert(
          "Notifications disabled",
          "Please enable notifications in your system settings."
        );
        await persistEnabled(false);
        setEnabled(false);
        return;
      }

      await persistEnabled(true);
      setEnabled(true);
    } finally {
      setBusy(false);
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
    <View style={{ flex: 1, backgroundColor: bg }}>
      <NativeHeader title="App Settings" />

      <View style={{ padding: 16, gap: 20 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: text }}>
            Briefing
          </Text>
          <Text
            style={{ marginTop: 8, fontSize: 15, lineHeight: 20, color: muted }}
          >
            Choose a time and enable a daily notification.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: card,
            borderRadius: 12,
            padding: 14,
            gap: 12,
          }}
        >
          <Text style={{ fontWeight: "600", color: text }}>
            Status: {enabled ? "Enabled" : "Disabled"}
          </Text>

          <Pressable
            onPress={() => setShowPicker(true)}
            style={{
              borderWidth: 1,
              borderColor: border,
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: muted }}>Briefing time</Text>
            <Text style={{ color: text, fontWeight: "600" }}>{timeLabel}</Text>
          </Pressable>

          {showPicker && (
            <DateTimePicker
              mode="time"
              value={time}
              is24Hour
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onPickTime}
            />
          )}

          <Pressable
            disabled={busy}
            onPress={() => applySchedule(!enabled, time)}
            style={{
              marginTop: 4,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: border,
              alignSelf: "flex-start",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "600", color: text }}>
              {enabled ? "Disable briefing" : "Enable briefing"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 10,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", color: text }}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
