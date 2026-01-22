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

  return (
    <SafeAreaView
      style={{ flex: 1 }}
      edges={["top", "left", "right", "bottom"]}
    >
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        javaScriptEnabled
        bounces={false}
        domStorageEnabled
        overScrollMode="never"
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={`
          window.__DAEX_NATIVE__ = true;
          window.DAEX_NATIVE_BRIDGE = {
            postMessage: function (msg) {
              window.ReactNativeWebView?.postMessage(msg);
            }
          };
          true;
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
