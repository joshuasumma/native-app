import React from "react";
import { View, Text, Pressable, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  right?: React.ReactNode; // optional: button(s) on the right
};

/**
 * Looks like the web app's StructureBar: a white rounded bar with a round
 * back button and the title, floating on the grey page background.
 */
export function NativeHeader({ title, right }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // Web color tokens: --color__grey150, --color__white, --color__black
  const page = isDark ? "#414141" : "#f8f8f8";
  const bar = isDark ? "#111111" : "#ffffff";
  const text = isDark ? "#ffffff" : "#000000";

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: page }}>
      <View
        style={{
          marginHorizontal: 15,
          marginVertical: 10,
          padding: 10,
          borderRadius: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: bar,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: page,
          }}
        >
          <Ionicons name="chevron-back" size={22} color={text} />
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 20,
            fontWeight: "700",
            letterSpacing: 0.24,
            color: text,
          }}
        >
          {title}
        </Text>

        {right}
      </View>
    </SafeAreaView>
  );
}
