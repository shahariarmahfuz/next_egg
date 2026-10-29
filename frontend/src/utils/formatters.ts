import { format, formatInTimeZone } from "date-fns-tz";
import { useSettingsStore } from "@/store/settings";

/**
 * Replace character using thousand and decimal separator
 */
function applySeparators(valueStr: string, thousandSep: string, decimalSep: string) {
  // First, we parse the default US string which uses ',' for thousand and '.' for decimal
  // e.g., "1,234,567.89"
  
  if (thousandSep === "," && decimalSep === ".") return valueStr;
  
  // Replace comma with a temp char, dot with decimal separator, temp char with thousand separator
  return valueStr.replace(/,/g, "_TEMP_").replace(/\./g, decimalSep).replace(/_TEMP_/g, thousandSep);
}

/**
 * Format raw numbers as localized currency strings based on Business Settings
 */
export function formatCurrency(amount: number | undefined | null): string {
  const { settings } = useSettingsStore.getState();
  const { currency, thousand_separator, decimal_separator } = settings;

  // Safely handle null/undefined/NaN values to prevent 'NaN' display
  const safeAmount = (amount == null || isNaN(amount)) ? 0 : amount;

  // Format number using standard US format first to get thousands and decimal correctly
  const numStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency.decimal_places,
  }).format(safeAmount);

  const localizedNum = applySeparators(numStr, thousand_separator, decimal_separator);

  if (currency.symbol_position === "before") {
    return `${currency.symbol} ${localizedNum}`;
  } else {
    return `${localizedNum} ${currency.symbol}`;
  }
}

/**
 * Format raw numbers with thousand and decimal separators
 */
export function formatNumber(amount: number | undefined | null, forceDecimals?: number): string {
  const { settings } = useSettingsStore.getState();
  const { currency, thousand_separator, decimal_separator } = settings;
  const decimals = forceDecimals !== undefined ? forceDecimals : currency.decimal_places;

  // Safely handle null/undefined/NaN values
  const safeAmount = (amount == null || isNaN(amount)) ? 0 : amount;

  const numStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(safeAmount);

  return applySeparators(numStr, thousand_separator, decimal_separator);
}

/**
 * Normalize date format tokens for date-fns (e.g., YYYY -> yyyy, DD -> dd).
 */
export function normalizeDateFormat(fmt?: string): string {
  if (!fmt) return "MMM dd, yyyy";
  return fmt
    .replace(/YYYY/g, "yyyy")
    .replace(/YY/g, "yy")
    .replace(/DD/g, "dd");
}

/**
 * Normalize time format tokens for date-fns (e.g., "24h" -> "HH:mm", "12h" -> "hh:mm a").
 */
export function normalizeTimeFormat(fmt?: string): string {
  if (!fmt) return "hh:mm a";
  const trimmed = fmt.trim();
  if (trimmed === "24h" || trimmed === "24") return "HH:mm";
  if (trimmed === "12h" || trimmed === "12") return "hh:mm a";
  return trimmed;
}

/**
 * Safely validate timezone, fallback to UTC.
 */
function getValidTimezone(tz?: string): string {
  if (!tz || tz === "UTC") return "Asia/Dhaka";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "Asia/Dhaka";
  }
}

/**
 * Format ISO Date strings based on timezone and date format.
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  const tz = getValidTimezone(settings?.timezone);
  const fmt = normalizeDateFormat(settings?.date_format);

  try {
    // If it is a date-only string like "2026-10-07", parse it in UTC so calendar day does not shift
    if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
      const [year, month, day] = dateString.trim().split("-").map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, day));
      return formatInTimeZone(utcDate, "UTC", fmt);
    }

    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return String(dateString);
    return formatInTimeZone(date, tz, fmt);
  } catch {
    try {
      const date = typeof dateString === "string" ? new Date(dateString) : dateString;
      if (!isNaN(date.getTime())) {
        return formatInTimeZone(date, tz, "yyyy-MM-dd");
      }
    } catch {}
    return String(dateString);
  }
}

/**
 * Format Time string based on timezone and time format.
 */
export function formatTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  const tz = getValidTimezone(settings?.timezone);
  const fmt = normalizeTimeFormat(settings?.time_format);

  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return String(dateString);
    return formatInTimeZone(date, tz, fmt);
  } catch {
    try {
      const date = typeof dateString === "string" ? new Date(dateString) : dateString;
      if (!isNaN(date.getTime())) {
        return formatInTimeZone(date, tz, "HH:mm");
      }
    } catch {}
    return String(dateString);
  }
}

/**
 * Format ISO Date and Time strings based on timezone.
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  const tz = getValidTimezone(settings?.timezone);
  const dateFmt = normalizeDateFormat(settings?.date_format);
  const timeFmt = normalizeTimeFormat(settings?.time_format);
  const fmt = `${dateFmt} ${timeFmt}`;

  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return String(dateString);
    return formatInTimeZone(date, tz, fmt);
  } catch {
    const d = formatDate(dateString);
    const t = formatTime(dateString);
    return `${d} ${t}`.trim();
  }
}

/**
 * Format bytes into human readable sizes.
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export * from "./price";

