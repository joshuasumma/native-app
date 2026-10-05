import ExpoModulesCore

// Mirrors TaskPlayerState in src/TaskPlayer.types.ts
struct TaskPlayerState: Record {
  @Field var mode: String = "idle"
  @Field var title: String = ""
  @Field var subtitle: String?
  @Field var startedAt: Double?
  @Field var endsAt: Double?
  @Field var progress: Double?
  @Field var progressPerMinute: Double?
}

/// Live Activity for the task player (ActivityKit). The lock screen /
/// Dynamic Island UI itself lives in a separate widget extension target.
public class TaskPlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TaskPlayer")

    // Not implemented on iOS yet: callers skip showAsync/endAsync
    Function("isSupported") {
      false
    }

    AsyncFunction("showAsync") { (_: TaskPlayerState) in
    }

    AsyncFunction("endAsync") {
    }

    // iOS delivers scheduled notifications on time without a permission
    Function("canScheduleExactAlarms") {
      true
    }

    Function("openExactAlarmSettings") {
    }
  }
}
