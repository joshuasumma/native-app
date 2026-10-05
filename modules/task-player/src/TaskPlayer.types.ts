/**
 * What the task player shows outside the app: an ongoing notification on
 * Android, a Live Activity on iOS. Mirrors NativeTaskPlayerState in the web
 * app (daex-frontend services/nativeBridge.ts). Times are epoch ms, so the
 * system runs the clock itself - the app doesn't update every second.
 */
export type TaskPlayerState = {
  mode: "work" | "break" | "idle";
  title: string;
  subtitle?: string;
  // Clock counts up from startedAt, or down to endsAt (Pomodoro)
  startedAt?: number;
  endsAt?: number;
  // 0..1 when sent, and how much it grows per minute while running
  progress?: number;
  progressPerMinute?: number;
  // Alerting notification when the clock reaches endsAt
  alert?: { title: string; body?: string };
};
