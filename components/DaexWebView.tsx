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
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { TaskPlayerState } from "@/modules/task-player";
import { applyTaskPlayerState } from "@/scripts/taskPlayer";
import {
  connectDeviceCalendar,
  disconnectDeviceCalendar,
  getDeviceCalendarEvents,
  getDeviceCalendarStatus,
  openDeviceCalendarEvent,
  selectDeviceCalendars,
} from "@/scripts/deviceCalendar";

// Deep link the backend redirects to after sign-in (see the backend's oauth/native-callback routes)
const NATIVE_OAUTH_REDIRECT = "daex://oauth";
// Providers run in the system browser; only their sign-in pages may be opened
const NATIVE_OAUTH_PROVIDERS = ["google", "microsoft"];
// Features the web app may use in this app version (window.__DAEX_NATIVE_FEATURES__)
const NATIVE_FEATURES = ["deviceCalendar"];
const ALLOWED_OAUTH_URL =
  /^https:\/\/(accounts\.google\.com|login\.microsoftonline\.com)\//;
// Must match WKAppBoundDomains in app.json. iOS only runs the web app's service
// worker for app-bound domains, but then blocks navigation to every other domain.
const APP_BOUND_DOMAINS = ["daex.app"];

const hostOf = (url: string) => url.match(/^https?:\/\/([^/:?#]+)/i)?.[1] ?? "";

type Props = {
  url: string;
  onLoadError?: () => void;
};

export function DaexWebView({ url, onLoadError }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Off for the dev server (LAN IP), which is not an app-bound domain
  const limitToAppBound =
    Platform.OS === "ios" && APP_BOUND_DOMAINS.includes(hostOf(url));

  // Pages on other domains would fail to load (and show the offline screen),
  // so open them in the system browser instead.
  const onShouldStartLoadWithRequest = (req: ShouldStartLoadRequest) => {
    if (!limitToAppBound || !req.isTopFrame) return true;
    const host = hostOf(req.url);
    if (!host || APP_BOUND_DOMAINS.includes(host)) return true;
    WebBrowser.openBrowserAsync(req.url);
    return false;
  };

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
          `window.__daexNativeResume && window.__daexNativeResume(); window.dispatchEvent(new Event("daex:native-resume")); true;`,
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
    | { type: "TASK_PLAYER_STATE"; state: TaskPlayerState | null }
    | { type: "DEVICE_CALENDAR_OPEN"; id: string }
    // Requests: answered with a RESPONSE carrying the same requestId
    | { type: "DEVICE_CALENDAR_STATUS"; requestId: string }
    | {
        type: "DEVICE_CALENDAR_CONNECT";
        requestId: string;
        connectedProviders: string[];
      }
    | {
        type: "DEVICE_CALENDAR_SELECT";
        requestId: string;
        calendarIds: string[];
      }
    | { type: "DEVICE_CALENDAR_DISCONNECT"; requestId: string }
    | {
        type: "DEVICE_CALENDAR_EVENTS";
        requestId: string;
        timeMin: string;
        timeMax: string;
      };

  // Answers a request of the web app (requestNative in nativeBridge.ts)
  const respond = async (requestId: string, run: () => Promise<unknown>) => {
    let response;
    try {
      response = { type: "RESPONSE", requestId, ok: true, data: await run() };
    } catch (error) {
      response = { type: "RESPONSE", requestId, ok: false, reason: String(error) };
    }
    // Stringified twice: once for the message, once as a JS string literal
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(
        JSON.stringify(response),
      )} })); true;`,
    );
  };

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

      switch (msg.type) {
        case "DEVICE_CALENDAR_STATUS":
          respond(msg.requestId, getDeviceCalendarStatus);
          break;
        case "DEVICE_CALENDAR_CONNECT":
          respond(msg.requestId, () =>
            connectDeviceCalendar(msg.connectedProviders),
          );
          break;
        case "DEVICE_CALENDAR_SELECT":
          respond(msg.requestId, () => selectDeviceCalendars(msg.calendarIds));
          break;
        case "DEVICE_CALENDAR_DISCONNECT":
          respond(msg.requestId, disconnectDeviceCalendar);
          break;
        case "DEVICE_CALENDAR_EVENTS":
          respond(msg.requestId, () =>
            getDeviceCalendarEvents(msg.timeMin, msg.timeMax),
          );
          break;
        case "DEVICE_CALENDAR_OPEN":
          openDeviceCalendarEvent(msg.id).catch(() => {});
          break;
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
          window.__DAEX_NATIVE_FEATURES__ = ${JSON.stringify(NATIVE_FEATURES)};
          window.DAEX_NATIVE_BRIDGE = {
            postMessage: function (msg) {
              window.ReactNativeWebView?.postMessage(msg);
            }
          };
          true;
        `}
        onMessage={onMessage}
        limitsNavigationsToAppBoundDomains={limitToAppBound}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
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
