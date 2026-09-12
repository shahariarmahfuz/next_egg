import { normalizeBengaliDigits } from "./bengali-normalizer";

/**
 * Sanitizes numeric input:
 * - Normalizes Bengali digits (০-৯) to English digits (0-9)
 * - Allows leading dot (e.g. ".5" -> "0.5", "." -> "0.")
 * - Removes invalid non-digit characters (allowing at most one decimal point and optional leading minus)
 * - Normalizes redundant leading zeros (e.g. "00.5" -> "0.5", "05" -> "5", "005" -> "5", while keeping "0", "0.", "0.0")
 */
export function sanitizeNumericInput(val: string | number, allowNegative: boolean = false): string {
  if (val === "" || val === undefined || val === null) return "";

  // 1. Normalize Bengali digits to English
  let s = normalizeBengaliDigits(String(val));

  // 2. Normalize leading dot: ".5" -> "0.5", "." -> "0."
  if (s.startsWith(".")) {
    s = "0" + s;
  } else if (allowNegative && s.startsWith("-.")) {
    s = "-0." + s.slice(2);
  }

  // 3. Filter chars: keep digits, at most one decimal point, optional leading minus
  let result = "";
  let hasDecimal = false;
  let hasSign = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === "-" && allowNegative && i === 0 && !hasSign) {
      hasSign = true;
      result += char;
    } else if (char === "." && !hasDecimal) {
      hasDecimal = true;
      result += char;
    } else if (/[0-9]/.test(char)) {
      result += char;
    }
  }

  // 4. Normalize redundant leading zeros
  const sign = result.startsWith("-") ? "-" : "";
  let numPart = sign ? result.slice(1) : result;

  // e.g. "05" -> "5", "005" -> "5"
  if (/^0+[0-9]/.test(numPart)) {
    numPart = numPart.replace(/^0+([0-9])/, "$1");
  }
  // e.g. "00." -> "0.", "00.5" -> "0.5"
  if (/^0+\./.test(numPart)) {
    numPart = numPart.replace(/^0+\./, "0.");
  }

  return sign + numPart;
}
