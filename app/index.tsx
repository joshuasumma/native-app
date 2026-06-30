import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { DaexWebView } from "@/components/DaexWebView";
import { OfflineScreen } from "@/components/OfflineScreen";

const URL = "http://daex.app/"; //"http://192.168.2.112:3000/"; //

export default function Index() {
  const [isOnline, setIsOnline] = useState(true);
  const [webKey, setWebKey] = useState(0);
  const FORCE_OFFLINE = false; // <-- for testing

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isInternetReachable ?? state.isConnected);
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    setWebKey((k) => k + 1);
  }, [isOnline]);

  const retry = () => {
    NetInfo.fetch().then((s) => {
      const online = Boolean(s.isInternetReachable ?? s.isConnected);
      setIsOnline(online);
      if (online) setWebKey((k) => k + 1);
    });
  };

  if (FORCE_OFFLINE || !isOnline) return <OfflineScreen onRetry={retry} />;

  return (
    <DaexWebView
      key={webKey}
      url={URL}
      onLoadError={() => setIsOnline(false)}
      userAgent={`${Platform.OS}`}
    />
  );
}
