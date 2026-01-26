import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { router } from "expo-router";

type Props = {
  url: string;
  onLoadError?: () => void;
  userAgent?: string;
};

export function DaexWebView({ url, onLoadError, userAgent }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const onAndroidBackPress = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      onAndroidBackPress,
    );
    return () => sub.remove();
  }, [onAndroidBackPress]);

  type BridgeMessage =
    | { type: "OPEN_NATIVE_MENU" }
    | { type: "OPEN_PUSH_SETTINGS" }
    | { type: "GET_PUSH_STATUS" };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg: BridgeMessage = JSON.parse(event.nativeEvent.data);

      if (msg.type === "OPEN_NATIVE_MENU") {
        router.push("/native/app-settings");
      }

      if (msg.type === "GET_PUSH_STATUS") {
        // You can respond here later
      }
    } catch {
      // ignore
    }
  };

  const cssFix = `
  (function() {
    const s = document.createElement('style');
    s.innerHTML = \`
      html, body { margin: 0 !important; padding: 0 !important; }
      body { padding-top: 0 !important; }
    \`;
    document.head.appendChild(s);
  })();
  true;
`;
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <WebView
        style={{ flex: 1 }}
        ref={webViewRef}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        source={{ uri: url }}
        javaScriptEnabled
        bounces={false}
        domStorageEnabled
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={`
          window.__DAEX_NATIVE__ = true;
          window.DAEX_NATIVE_BRIDGE = {
            postMessage: function (msg) {
              window.ReactNativeWebView?.postMessage(msg);
            }
          };
          true;
           ${cssFix}
        `}
        onMessage={onMessage}
        allowsBackForwardNavigationGestures
        userAgent={userAgent}
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
