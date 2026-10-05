// The OAuth deep link is consumed by WebBrowser.openAuthSessionAsync in DaexWebView.
// On Android it also reaches the router, which has no such route, so keep it on the WebView.
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  if (/^(daex:\/\/)?\/?oauth\b/.test(path)) return "/";
  return path;
}
