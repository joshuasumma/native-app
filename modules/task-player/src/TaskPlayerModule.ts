import { NativeModule, requireOptionalNativeModule } from "expo";

import { TaskPlayerState } from "./TaskPlayer.types";

declare class TaskPlayerModule extends NativeModule {
  // False where the system can't show it (notifications off, iOS for now)
  isSupported(): boolean;
  // Shows the player, or updates it if it is already showing
  showAsync(state: TaskPlayerState): Promise<void>;
  endAsync(): Promise<void>;
  // Android 12+: whether timer alerts may ring exactly on time
  // ("Alarms & reminders"); true where no permission is needed
  canScheduleExactAlarms(): boolean;
  // Opens the system switch for it
  openExactAlarmSettings(): void;
}

// null in builds without the native code (e.g. Expo Go)
export default requireOptionalNativeModule<TaskPlayerModule>("TaskPlayer");
