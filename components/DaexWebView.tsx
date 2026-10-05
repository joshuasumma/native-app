import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  View,
  ActivityIndicator,
  AppStateStatus,
  AppState,
} from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { TaskPlayerState } from "@/modules/task-player";
import { applyTaskPlayerState } from "@/scripts/taskPlayer";

// Deep link the backend redirects to after sign-in (see the backend's oauth/native-callback routes)
const NATIVE_OAUTH_REDIRECT = "daex://oauth";
// Providers run in the system browser; only their sign-in pages may be opened
const NATIVE_OAUTH_PROVIDERS = ["google", "microsoft"];
const ALLOWED_OAUTH_URL =
  /^https:\/\/(accounts\.google\.com|login\.microsoftonline\.com)\//;

type Props = {
  url: string;
  onLoadError?: () => void;
};

export function DaexWebView({ url, onLoadError }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const onAndroidBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && nextState === "active";
      appState.current = nextState;
      if (cameToForeground) {
        webViewRef.current?.injectJavaScript(
          `window.__daexNativeResume && window.__daexNativeResume(); true;`,
        );
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      onAndroidBackPress,
    );
    return () => sub.remove();
  }, [onAndroidBackPress]);
  const lastNavRef = useRef<number>(0);

  type BridgeMessage =
    | { type: "OPEN_NATIVE_MENU" }
    | { type: "OPEN_PUSH_SETTINGS" }
    | { type: "GET_PUSH_STATUS" }
    | { type: "OAUTH_OPEN"; url: string }
    | { type: "TASK_PLAYER_STATE"; state: TaskPlayerState | null };

  // Google and Microsoft block (or break) sign-in inside WebViews, so it runs in the system browser.
  // The PKCE verifier stays in the WebView's sessionStorage, so the result is
  // handed back to the web app's normal callback page to finish the login.
  const openOAuthInBrowser = async (url: string) => {
    if (!ALLOWED_OAUTH_URL.test(url)) return;

    const result = await WebBrowser.openAuthSessionAsync(
      url,
      NATIVE_OAUTH_REDIRECT,
    );
    if (result.type !== "success") return; // cancelled: stay on the current page

    const query = result.url.split("?")[1] ?? "";
    if (!/(^|&)code=/.test(query)) return;

    const target = JSON.stringify(`/oauth/callback/?${query}`);
    webViewRef.current?.injectJavaScript(
      `window.location.assign(${target}); true;`,
    );
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg: BridgeMessage = JSON.parse(event.nativeEvent.data);

      if (msg.type === "OPEN_NATIVE_MENU") {
        const now = Date.now();
        if (now - lastNavRef.current < 1000) return; // ignore duplicate within 1s
        lastNavRef.current = now;
        router.push("/native/app-settings");
      }

      if (msg.type === "OAUTH_OPEN") {
        openOAuthInBrowser(msg.url);
      }

      if (msg.type === "TASK_PLAYER_STATE") {
        applyTaskPlayerState(msg.state);
      }

      if (msg.type === "GET_PUSH_STATUS") {
        // You can respond here later
      }
    } catch {
      // ignore
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1 }}
      edges={
        ["top", "left", "right", Platform.OS !== "ios" && "bottom"].filter(
          Boolean,
        ) as Edge[]
      }
    >
      <WebView
        style={{ flex: 1 }}
        ref={webViewRef}
        source={{ uri: url }}
        javaScriptEnabled
        bounces={false}
        domStorageEnabled
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={`
          window.__DAEX_NATIVE__ = true;
          window.__DAEX_NATIVE_OAUTH__ = ${JSON.stringify(NATIVE_OAUTH_PROVIDERS)};
          window.DAEX_NATIVE_BRIDGE = {
            postMessage: function (msg) {
              window.ReactNativeWebView?.postMessage(msg);
            }
          };
          true;
        `}
        onMessage={onMessage}
        allowsBackForwardNavigationGestures
        // Appends to the real browser UA; replacing it breaks sites that sniff it (OAuth providers, autofill)
        applicationNameForUserAgent={`DAEX-App/${Platform.OS}`}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        onError={() => onLoadError?.()}
        renderLoading={() => (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
