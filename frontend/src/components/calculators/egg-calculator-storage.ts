export type LooseCategoryKey = "good" | "cracked" | "broken" | "spoiled";

export interface StackRow {
  id: string;
  traysPerStack: number | "";
  stacksCount: number | "";
}

export interface CalculatorState {
  eggsPerTray: number;
  stacks: StackRow[];
  looseEntries?: Record<LooseCategoryKey, number[]>;
  nextDaySell?: number | "";
  selectedProductId?: string;
  // Legacy single-value compatibility
  looseGood?: number | "";
  looseCracked?: number | "";
  looseBroken?: number | "";
  looseSpoiled?: number | "";
}

export interface CalculatorHistoryEntry {
  id: string;
  createdAt: string;
  formattedDate: string;
  productId?: string;
  productName?: string;
  systemStock?: number | null;
  stacks: StackRow[];
  looseEntries: Record<LooseCategoryKey, number[]>;
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

const EMPTY_LOOSE_ENTRIES: Record<LooseCategoryKey, number[]> = {
  good: [],
  cracked: [],
  broken: [],
  spoiled: [],
};

export function createDefaultStacks(): StackRow[] {
  return [{ id: Date.now().toString(), traysPerStack: 20, stacksCount: "" }];
}

export function normalizeLooseEntries(
  entries?: Partial<Record<LooseCategoryKey, unknown>>
): Record<LooseCategoryKey, number[]> {
  return {
    good: Array.isArray(entries?.good) ? entries.good.map(Number).filter((n) => !isNaN(n)) : [],
    cracked: Array.isArray(entries?.cracked) ? entries.cracked.map(Number).filter((n) => !isNaN(n)) : [],
    broken: Array.isArray(entries?.broken) ? entries.broken.map(Number).filter((n) => !isNaN(n)) : [],
    spoiled: Array.isArray(entries?.spoiled) ? entries.spoiled.map(Number).filter((n) => !isNaN(n)) : [],
  };
}

export function readCalculatorState(): CalculatorState | null {
  try {
    const saved = localStorage.getItem(CALCULATOR_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? (parsed as CalculatorState) : null;
  } catch (err) {
    console.warn("Failed to load calculator state from localStorage:", err);
    return null;
  }
}

export function writeCalculatorState(state: CalculatorState): void {
  try {
    localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save calculator state to localStorage:", err);
  }
}

export function clearCalculatorState(): void {
  try {
    localStorage.removeItem(CALCULATOR_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear calculator state from localStorage:", err);
  }
}

export function readCalculatorHistory(): CalculatorHistoryEntry[] {
  try {
    const saved = localStorage.getItem(CALCULATOR_HISTORY_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as CalculatorHistoryEntry[]) : [];
  } catch (err) {
    console.warn("Failed to load calculator history from localStorage:", err);
    return [];
  }
}

export function writeCalculatorHistory(entries: CalculatorHistoryEntry[]): void {
  try {
    localStorage.setItem(CALCULATOR_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("Failed to save calculator history to localStorage:", err);
  }
}

export function clearCalculatorHistory(): void {
  try {
    localStorage.removeItem(CALCULATOR_HISTORY_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear calculator history from localStorage:", err);
  }
}

export function loadHistoryEntryIntoCalculatorState(entry: CalculatorHistoryEntry): void {
  const existing = readCalculatorState();
  const nextStacks =
    Array.isArray(entry.stacks) && entry.stacks.length > 0
      ? entry.stacks
      : existing?.stacks && existing.stacks.length > 0
      ? existing.stacks
      : createDefaultStacks();

  writeCalculatorState({
    eggsPerTray: EGGS_PER_TRAY,
    stacks: nextStacks,
    looseEntries: entry.looseEntries
      ? normalizeLooseEntries(entry.looseEntries)
      : { ...EMPTY_LOOSE_ENTRIES },
    nextDaySell: entry.nextDaySell ?? "",
    selectedProductId: entry.productId ?? "",
  });
}

export function formatStockVerificationText(
  productName: string | undefined,
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
