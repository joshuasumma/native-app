import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const handledRef = useRef(false);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (handledRef.current) return;
        handledRef.current = true;
        const data = response.notification.request.content.data;

        if (data?.type === "BRIEFING") {
          // open native screen
          router.replace("/native/app-settings");
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
