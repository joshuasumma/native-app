declare namespace NodeJS {
  interface ProcessEnv {
    /** Web app URL loaded in the WebView. Set in .env.development / .env.production */
    EXPO_PUBLIC_API_URL: string;
  }
}
