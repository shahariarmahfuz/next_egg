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
export function formatCurrency(amount: number): string {
  const { settings } = useSettingsStore.getState();
  const { currency, thousand_separator, decimal_separator } = settings;

  // Format number using standard US format first to get thousands and decimal correctly
  const numStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency.decimal_places,
  }).format(amount);

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
export function formatNumber(amount: number, forceDecimals?: number): string {
  const { settings } = useSettingsStore.getState();
  const { currency, thousand_separator, decimal_separator } = settings;
  const decimals = forceDecimals !== undefined ? forceDecimals : currency.decimal_places;

  const numStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);

  return applySeparators(numStr, thousand_separator, decimal_separator);
}

/**
 * Format ISO Date strings based on timezone and date format.
 */
export function formatDate(dateString: string | Date): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return formatInTimeZone(date, settings.timezone, settings.date_format);
  } catch {
    return String(dateString);
  }
}

/**
 * Format Time string based on timezone and time format.
 */
export function formatTime(dateString: string | Date): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return formatInTimeZone(date, settings.timezone, settings.time_format);
  } catch {
    return String(dateString);
  }
}

/**
 * Format ISO Date and Time strings based on timezone.
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "";
  const { settings } = useSettingsStore.getState();
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    const formatStr = `${settings.date_format} ${settings.time_format}`;
    return formatInTimeZone(date, settings.timezone, formatStr);
  } catch {
    return String(dateString);
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
