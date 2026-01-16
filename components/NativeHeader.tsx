import React from "react";
import { View, Text, Pressable, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  right?: React.ReactNode; // optional: button(s) on the right
};

export function NativeHeader({ title, right }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const bg = isDark ? "#000000" : "#ffffff";
  const text = isDark ? "#ffffff" : "#000000";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: bg }}>
      <View
        style={{
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: border,
          backgroundColor: bg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{ paddingHorizontal: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={text} />
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "600",
            color: text,
            marginHorizontal: 8,
          }}
        >
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
}
