import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useSettingsStore } from "@/store/settings";

/**
 * Business-timezone aware date helpers.
 *
 * NEVER use `new Date().toISOString().split("T")[0]` to get "today" — that returns the
 * UTC calendar date, which for Asia/Dhaka (UTC+6) is still *yesterday* between
 * 00:00 and 05:59 local time. Likewise `new Date("YYYY-MM-DD")` parses as UTC midnight
 * (06:00 in Dhaka). These helpers always resolve dates in the business timezone.
 */

const FALLBACK_TZ = "Asia/Dhaka";

/** Business timezone: settings.timezone (if not UTC) -> browser timezone -> Asia/Dhaka. */
export function getBusinessTimeZone(): string {
  try {
    const tz = useSettingsStore.getState().settings?.timezone;
    if (tz && tz !== "UTC") return tz;
  } catch {
    // store not available
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

function safeFormat(date: Date, pattern: string): string {
  try {
    return formatInTimeZone(date, getBusinessTimeZone(), pattern);
  } catch {
    return formatInTimeZone(date, FALLBACK_TZ, pattern);
  }
}

/** Today's calendar date (YYYY-MM-DD) in the business timezone. */
export function getTodayDateStr(): string {
  return safeFormat(new Date(), "yyyy-MM-dd");
}

/** Converts an ISO timestamp (or Date) to its YYYY-MM-DD calendar date in the business timezone. */
export function toBusinessDateStr(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return safeFormat(d, "yyyy-MM-dd");
}

/**
 * Converts a calendar date (YYYY-MM-DD) chosen in a date picker into an ISO timestamp for the API.
 * - If `originalISO` is given and the user did not change the calendar day, the original timestamp is kept.
 * - If the date is today, the current exact time is used.
 * - Otherwise 12:00 noon in the business timezone is used (safely inside the day).
 */
export function businessDateToISO(dateStr: string, originalISO?: string | null): string {
  if (!dateStr) return new Date().toISOString();
  if (originalISO && toBusinessDateStr(originalISO) === dateStr) {
    return new Date(originalISO).toISOString();
  }
  if (dateStr === getTodayDateStr()) {
    return new Date().toISOString();
  }
  return fromZonedTime(`${dateStr}T12:00:00`, getBusinessTimeZone()).toISOString();
}

/** Value for an <input type="datetime-local"> (YYYY-MM-DDTHH:mm) in the business timezone. */
export function toDateTimeLocalStr(value?: string | Date | null): string {
  const d = value ? (value instanceof Date ? value : new Date(value)) : new Date();
  if (isNaN(d.getTime())) return safeFormat(new Date(), "yyyy-MM-dd'T'HH:mm");
  return safeFormat(d, "yyyy-MM-dd'T'HH:mm");
}

/** Converts an <input type="datetime-local"> value (business timezone wall clock) into an ISO timestamp. */
export function dateTimeLocalToISO(value: string): string {
  if (!value) return new Date().toISOString();
  return fromZonedTime(value, getBusinessTimeZone()).toISOString();
}
