package app.daex.taskplayer

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// Mirrors TaskPlayerState in src/TaskPlayer.types.ts
class TaskPlayerState : Record {
  @Field val mode: String = "idle"
  @Field val title: String = ""
  @Field val subtitle: String? = null
  @Field val startedAt: Double? = null
  @Field val endsAt: Double? = null
  @Field val progress: Double? = null
  @Field val progressPerMinute: Double? = null
}

private const val CHANNEL_ID = "task_player"
private const val NOTIFICATION_ID = 4711
// The clock runs by itself; only the progress bar needs redrawing
private const val REFRESH_MS = 60_000L

// Web color tokens --color__red500 / --color__green500
private val WORK_COLOR = Color.parseColor("#e7363c")
private val BREAK_COLOR = Color.parseColor("#79bc5c")

/**
 * Task player as a notification: ongoing while working or on a break (with
 * the system clock counting up or down), swipeable when nothing is running.
 * All calls run on the main thread, which also runs the refresh.
 */
class TaskPlayerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val handler = Handler(Looper.getMainLooper())
  private var state: TaskPlayerState? = null
  private var receivedAt = 0L

  private val refresh = object : Runnable {
    override fun run() {
      post()
      handler.postDelayed(this, REFRESH_MS)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("TaskPlayer")

    Function("isSupported") {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    AsyncFunction("showAsync") { newState: TaskPlayerState ->
      state = newState
      receivedAt = System.currentTimeMillis()
      handler.removeCallbacks(refresh)
      post()
      if (newState.mode != "idle" && newState.progressPerMinute != null) {
        handler.postDelayed(refresh, REFRESH_MS)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("endAsync") {
      state = null
      handler.removeCallbacks(refresh)
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }.runOnQueue(Queues.MAIN)

    // Timer alerts are scheduled by expo-notifications, which rings exactly
    // only with "Alarms & reminders" allowed (off by default on Android 14+)
    Function("canScheduleExactAlarms") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    // The notification itself stays: it is correct without the app running
    OnDestroy {
      handler.removeCallbacks(refresh)
    }
  }

  // Permission is checked through areNotificationsEnabled
  @SuppressLint("MissingPermission")
  private fun post() {
    val s = state ?: return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    ensureChannel()

    val running = s.mode != "idle"
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setContentTitle(s.title)
      .setContentText(s.subtitle)
      .setContentIntent(openAppIntent())
      .setColor(if (s.mode == "work") WORK_COLOR else BREAK_COLOR)
      .setOngoing(running)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(
        if (running) NotificationCompat.CATEGORY_STOPWATCH
        else NotificationCompat.CATEGORY_STATUS
      )

    // The system clock in the header: down to endsAt, otherwise up from startedAt
    val clockBase = s.endsAt ?: s.startedAt
    if (running && clockBase != null) {
      builder
        .setShowWhen(true)
        .setWhen(clockBase.toLong())
        .setUsesChronometer(true)
        .setChronometerCountDown(s.endsAt != null)
    }

    currentProgress(s)?.let {
      builder.setProgress(1000, (it * 1000).toInt(), false)
    }

    manager.notify(NOTIFICATION_ID, builder.build())
  }

  // Progress when sent, grown by the time since then
  private fun currentProgress(s: TaskPlayerState): Double? {
    val progress = s.progress ?: return null
    val minutes = (System.currentTimeMillis() - receivedAt) / 60_000.0
    return (progress + (s.progressPerMinute ?: 0.0) * minutes).coerceIn(0.0, 1.0)
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Task player",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      setShowBadge(false)
    }
    context.getSystemService(NotificationManager::class.java)
      .createNotificationChannel(channel)
  }

  // The monochrome icon expo-notifications generates from app.json, else the app icon
  @SuppressLint("DiscouragedApi")
  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier(
      "notification_icon",
      "drawable",
      context.packageName
    )
    return if (id != 0) id else context.applicationInfo.icon
  }

  private fun openAppIntent(): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
