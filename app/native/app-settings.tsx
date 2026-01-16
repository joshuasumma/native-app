import React from "react";
import { View, Text, Pressable, useColorScheme } from "react-native";
import { NativeHeader } from "@/components/NativeHeader";
import { router } from "expo-router";
import {
  requestNotificationPermission,
  scheduleTestNotification,
} from "@/scripts/notifications";

export default function PushSettings() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const bg = isDark ? "#000000" : "#ffffff";
  const text = isDark ? "#ffffff" : "#000000";
  const muted = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const card = isDark ? "#111111" : "#f6f6f6";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <NativeHeader title="App Settings" />

      <View style={{ padding: 16, gap: 20 }}>
        {/* Section */}
        <View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: text }}>
            Push Notifications
          </Text>

          <Text
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 20,
              color: muted,
            }}
          >
            Manage notification permissions and control whether the app can send
            reminders and briefings.
          </Text>
        </View>

        {/* Settings card */}
        <View
          style={{
            backgroundColor: card,
            borderRadius: 12,
            padding: 14,
            gap: 12,
          }}
        >
          <Text style={{ fontWeight: "600", color: text }}>
            Status: Not configured
          </Text>

          <Pressable
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              alignSelf: "flex-start",
            }}
            onPress={async () => {
              const ok = await requestNotificationPermission();
              if (!ok) {
                // you can show an alert here
                return;
              }
              await scheduleTestNotification(2);
            }}
          >
            <Text style={{ fontWeight: "600", color: text }}>
              Enable notifications
            </Text>
          </Pressable>
        </View>

        {/* Footer action */}
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", color: text }}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
