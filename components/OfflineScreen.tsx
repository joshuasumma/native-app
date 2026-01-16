import React from "react";
import { View, Text, Pressable, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  onRetry: () => void;
};

export function OfflineScreen({ onRetry }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const bg = isDark ? "#000000" : "#ffffff";
  const text = isDark ? "#ffffff" : "#000000";
  const muted = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)";
  const border = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const buttonBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: bg }}
      edges={["top", "left", "right"]}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "600", color: text }}>
          You’re offline
        </Text>

        <Text style={{ textAlign: "center", color: muted }}>
          Please check your connection and try again.
        </Text>

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: buttonBg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontWeight: "600", color: text }}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
