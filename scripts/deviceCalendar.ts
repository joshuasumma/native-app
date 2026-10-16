import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EntityTypes,
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendarPermissions,
  getCalendars,
  listEvents,
  requestCalendarPermissions,
} from "expo-calendar";

/**
 * The phone's calendars for the web app (DAEX shows them next to its own
 * events). Read on request only: events never leave the device and are not
 * sent to the backend. Which calendars to show is stored here, per device.
 * Message types mirror nativeBridge.ts in daex-frontend.
 */

// { connected, calendarIds } - unset: never connected
const SELECTION_KEY = "device_calendar_selection";

type Selection = { connected: boolean; calendarIds: string[] };

export type DeviceCalendarStatus = {
  permission: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
  connected: boolean;
  calendars: {
    id: string;
    title: string;
    color?: string;
    sourceName: string;
    selected: boolean;
  }[];
};

// Same shape as ScheduleItemDto in daex-frontend
export type DeviceScheduleItem = {
  id: string;
  type: "default" | "allDay";
  title: string;
  scheduleStart: string;
  scheduleEnd: string;
  location?: string;
  timeZone: string;
  origin: "device";
};

const readSelection = async (): Promise<Selection> => {
  try {
    const saved = await AsyncStorage.getItem(SELECTION_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { connected: false, calendarIds: [] };
};

const saveSelection = (selection: Selection) =>
  AsyncStorage.setItem(SELECTION_KEY, JSON.stringify(selection));

const eventCalendars = async (): Promise<ExpoCalendar[]> =>
  getCalendars(EntityTypes.EVENT);

// Calendars of accounts already connected in DAEX via OAuth would show their
// events twice. Detected by the account name (Gmail address, Outlook/Exchange).
const belongsToProvider = (calendar: ExpoCalendar, providers: string[]) => {
  const source = `${calendar.source?.name ?? ""} ${calendar.source?.type ?? ""}`;
  return (
    (providers.includes("google") && /google|gmail/i.test(source)) ||
    (providers.includes("microsoft") &&
      /exchange|outlook|hotmail|live\.|microsoft|office365/i.test(source))
  );
};

export async function getDeviceCalendarStatus(): Promise<DeviceCalendarStatus> {
  const permission = await getCalendarPermissions();
  const selection = await readSelection();
  const granted = permission.status === "granted";
  const calendars = granted ? await eventCalendars() : [];

  return {
    permission: permission.status as DeviceCalendarStatus["permission"],
    canAskAgain: permission.canAskAgain,
    connected: selection.connected,
    calendars: calendars.map((calendar) => ({
      id: calendar.id,
      title: calendar.title,
      color: calendar.color,
      sourceName: calendar.source?.name ?? "",
      selected: selection.calendarIds.includes(calendar.id),
    })),
  };
}

/** Asks for the permission and, the first time, preselects the calendars */
export async function connectDeviceCalendar(
  connectedProviders: string[],
): Promise<DeviceCalendarStatus> {
  const permission = await requestCalendarPermissions();
  const selection = await readSelection();

  if (permission.status === "granted" && selection.calendarIds.length === 0) {
    const calendars = await eventCalendars();
    selection.calendarIds = calendars
      .filter((calendar) => !belongsToProvider(calendar, connectedProviders))
      .map((calendar) => calendar.id);
  }
  // Also connected without permission: the web app then shows how to grant it
  await saveSelection({ ...selection, connected: true });
  return getDeviceCalendarStatus();
}

export async function selectDeviceCalendars(
  calendarIds: string[],
): Promise<DeviceCalendarStatus> {
  await saveSelection({ connected: true, calendarIds });
  return getDeviceCalendarStatus();
}

// The system permission can't be revoked by the app; DAEX just stops showing
// the events. The selection is kept for reconnecting.
export async function disconnectDeviceCalendar(): Promise<DeviceCalendarStatus> {
  const selection = await readSelection();
  await saveSelection({ ...selection, connected: false });
  return getDeviceCalendarStatus();
}

// "id|start": occurrences of a recurring event share the event id, but the
// web app dedupes by id. "|" because iOS event ids contain ":".
const toItemId = (eventId: string, start: Date) =>
  `device|${eventId}|${start.getTime()}`;

const parseItemId = (itemId: string) => {
  const parts = itemId.split("|");
  return {
    eventId: parts.slice(1, -1).join("|"),
    start: new Date(Number(parts[parts.length - 1])),
  };
};

const DAY = 24 * 60 * 60 * 1000;

// All-day events as the backend sends Google's: UTC midnight of the day, end
// exclusive. iOS gives local midnight to 23:59:59, Android UTC midnights.
const allDayBounds = (start: Date, end: Date) => {
  const utc = Platform.OS === "android";
  const dayStart = (date: Date) =>
    utc
      ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const startDay = dayStart(start);
  // -1 ms: an end at midnight belongs to the day before
  const endDay = Math.max(dayStart(new Date(end.getTime() - 1)), startDay) + DAY;
  return {
    scheduleStart: new Date(startDay).toISOString(),
    scheduleEnd: new Date(endDay).toISOString(),
  };
};

export async function getDeviceCalendarEvents(
  timeMin: string,
  timeMax: string,
): Promise<DeviceScheduleItem[]> {
  const selection = await readSelection();
  if (!selection.connected || selection.calendarIds.length === 0) return [];
  if ((await getCalendarPermissions()).status !== "granted") return [];

  // Calendars deleted on the phone would make the query fail
  const existingIds = new Set((await eventCalendars()).map((c) => c.id));
  const calendarIds = selection.calendarIds.filter((id) => existingIds.has(id));
  if (calendarIds.length === 0) return [];

  const events = await listEvents(
    calendarIds,
    new Date(timeMin),
    new Date(timeMax),
  );
  const fallbackTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return events.map((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return {
      id: toItemId(event.id, start),
      type: event.allDay ? "allDay" : "default",
      title: event.title,
      ...(event.allDay
        ? allDayBounds(start, end)
        : {
            scheduleStart: start.toISOString(),
            scheduleEnd: end.toISOString(),
          }),
      location: event.location || undefined,
      timeZone: event.timeZone || fallbackTimeZone,
      origin: "device",
    };
  });
}

/** Shows the system's own preview of the event (the occurrence for a series) */
export async function openDeviceCalendarEvent(itemId: string) {
  const { eventId, start } = parseItemId(itemId);
  const event = await ExpoCalendarEvent.get(eventId);
  const occurrence = event.recurrenceRule
    ? event.getOccurrenceSync({ instanceStartDate: start })
    : event;
  await occurrence.openInCalendar();
}
