import {
  CalculatorHistoryItem,
  CalculatorLooseCategoryKey,
  CalculatorLooseEntries,
  CalculatorStackRow,
} from "@/types/calculator";

export type LooseCategoryKey = CalculatorLooseCategoryKey;
export type StackRow = CalculatorStackRow;

export interface CalculatorState {
  eggsPerTray: number;
  stacks: StackRow[];
  looseEntries?: CalculatorLooseEntries;
  nextDaySell?: number | "";
  selectedProductId?: string;
  // Legacy single-value compatibility
  looseGood?: number | "";
  looseCracked?: number | "";
  looseBroken?: number | "";
  looseSpoiled?: number | "";
}

export interface LegacyLocalCalculatorHistoryEntry {
  id: string;
  createdAt: string;
  formattedDate: string;
  productId?: string;
  productName?: string;
  systemStock?: number | null;
  stacks: StackRow[];
  looseEntries: CalculatorLooseEntries;
  nextDaySell: number | "";
  totalTrays: number;
  totalTrayEggs: number;
  totalLooseEggs: number;
  nextDaySellEggs: number;
  grandTotalEggs: number;
  grandTotalConversion: { fullTrays: number; remainderEggs: number };
  stockDifference?: number | null;
}

export const CALCULATOR_STORAGE_KEY = "egg_calculator_v1";
export const CALCULATOR_HISTORY_STORAGE_KEY = "egg_calculator_history_v1";
export const EGGS_PER_TRAY = 30;

const EMPTY_LOOSE_ENTRIES: CalculatorLooseEntries = {
  good: [],
  cracked: [],
  broken: [],
  spoiled: [],
};

export function getCalculatorDraftKey(userId?: string): string {
  return userId ? `${CALCULATOR_STORAGE_KEY}_${userId}` : CALCULATOR_STORAGE_KEY;
}

export function createDefaultStacks(): StackRow[] {
  return [{ id: Date.now().toString(), traysPerStack: 20, stacksCount: "" }];
}

export function normalizeLooseEntries(
  entries?: Partial<Record<LooseCategoryKey, unknown>>
): CalculatorLooseEntries {
  return {
    good: Array.isArray(entries?.good) ? entries.good.map(Number).filter((n) => !isNaN(n)) : [],
    cracked: Array.isArray(entries?.cracked) ? entries.cracked.map(Number).filter((n) => !isNaN(n)) : [],
    broken: Array.isArray(entries?.broken) ? entries.broken.map(Number).filter((n) => !isNaN(n)) : [],
    spoiled: Array.isArray(entries?.spoiled) ? entries.spoiled.map(Number).filter((n) => !isNaN(n)) : [],
  };
}

export function readCalculatorState(userId?: string): CalculatorState | null {
  try {
    const saved =
      localStorage.getItem(getCalculatorDraftKey(userId)) ||
      (userId ? localStorage.getItem(CALCULATOR_STORAGE_KEY) : null);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? (parsed as CalculatorState) : null;
  } catch (err) {
    console.warn("Failed to load calculator state from localStorage:", err);
    return null;
  }
}

export function writeCalculatorState(state: CalculatorState, userId?: string): void {
  try {
    localStorage.setItem(getCalculatorDraftKey(userId), JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save calculator state to localStorage:", err);
  }
}

export function clearCalculatorState(userId?: string): void {
  try {
    localStorage.removeItem(getCalculatorDraftKey(userId));
    if (!userId) {
      localStorage.removeItem(CALCULATOR_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to clear calculator state from localStorage:", err);
  }
}

export function readLegacyLocalHistory(): LegacyLocalCalculatorHistoryEntry[] {
  try {
    const saved = localStorage.getItem(CALCULATOR_HISTORY_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as LegacyLocalCalculatorHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearLegacyLocalHistory(): void {
  try {
    localStorage.removeItem(CALCULATOR_HISTORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadDbHistoryEntryIntoCalculatorState(
  entry: CalculatorHistoryItem,
  userId?: string
): void {
  const existing = readCalculatorState(userId);
  const nextStacks =
    Array.isArray(entry.stacks) && entry.stacks.length > 0
      ? entry.stacks
      : existing?.stacks && existing.stacks.length > 0
      ? existing.stacks
      : createDefaultStacks();

  writeCalculatorState(
    {
      eggsPerTray: entry.eggs_per_tray || EGGS_PER_TRAY,
      stacks: nextStacks,
      looseEntries: entry.loose_entries
        ? normalizeLooseEntries(entry.loose_entries)
        : { ...EMPTY_LOOSE_ENTRIES },
      nextDaySell: entry.next_day_sell > 0 ? entry.next_day_sell : "",
      selectedProductId: entry.product_id ?? "",
    },
    userId
  );
}

export function formatStockVerificationText(
  productName: string | null | undefined,
  systemStock: number | null | undefined,
  grandTotalEggs: number,
  stockDifference?: number | null
): string {
  if (!productName || systemStock === null || systemStock === undefined) {
    return "";
  }
  const diff = stockDifference ?? grandTotalEggs - systemStock;
  const diffStr =
    diff === 0
      ? "হুবহু মিলে গেছে"
      : diff < 0
      ? `${diff.toLocaleString()} টি ঘাটতি (Shortage)`
      : `+${diff.toLocaleString()} টি অতিরিক্ত (Surplus)`;

  return `\n------------------------------\nপণ্য: ${productName}\nসিস্টেম স্টক: ${systemStock.toLocaleString()} টি\nস্টক যাচাই: ${diffStr}`;
}
