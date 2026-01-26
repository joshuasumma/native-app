import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        const data: any = resp.notification.request.content.data;
        if (data?.type === "BRIEFING") {
          router.replace("/"); // index route
        }
      },
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.type === "BRIEFING") {
          // open native screen
          router.push("/native/app-settings");

          // OR later: send a message into WebView to open /briefing
        }
      },
    );

    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="native/app-settings"
          options={{
            title: "App Settings",
            headerShown: false,
            animation: "simple_push",
          }}
        />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
