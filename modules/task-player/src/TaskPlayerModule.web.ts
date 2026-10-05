import { registerWebModule, NativeModule } from "expo";

// The web build has no system notification: everything is a no-op
class TaskPlayerModule extends NativeModule {
  isSupported() {
    return false;
  }
  async showAsync() {}
  async endAsync() {}
  canScheduleExactAlarms() {
    return true;
  }
  openExactAlarmSettings() {}
}

export default registerWebModule(TaskPlayerModule, "TaskPlayer");
