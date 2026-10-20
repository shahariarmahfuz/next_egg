"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Egg,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Calculator,
  AlertTriangle,
  Layers,
  X,
  Package,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CalendarDays,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type LooseCategoryKey = "good" | "cracked" | "broken" | "spoiled";

interface LooseCategoryConfig {
  key: LooseCategoryKey;
  title: string;
  dotColor: string;
}

const LOOSE_CATEGORIES: LooseCategoryConfig[] = [
  {
    key: "good",
    title: "Loose Eggs",
    dotColor: "bg-emerald-500",
  },
  {
    key: "cracked",
    title: "Cracked / Laga",
    dotColor: "bg-amber-500",
  },
  {
    key: "broken",
    title: "Broken / Fata",
    dotColor: "bg-rose-500",
  },
  {
    key: "spoiled",
    title: "Spoiled / Nosto",
    dotColor: "bg-red-600",
  },
];

interface StackRow {
  id: string;
  traysPerStack: number | "";
  stacksCount: number | "";
}

interface CalculatorState {
  eggsPerTray: number;
  stacks: StackRow[];
  looseEntries?: Record<LooseCategoryKey, number[]>;
  nextDaySell?: number | "";
  // Legacy single-value compatibility
  looseGood?: number | "";
  looseCracked?: number | "";
  looseBroken?: number | "";
  looseSpoiled?: number | "";
}

const STORAGE_KEY = "egg_calculator_v1";
const EGGS_PER_TRAY = 30;

const DEFAULT_STATE: CalculatorState = {
  eggsPerTray: EGGS_PER_TRAY,
  stacks: [
    { id: "1", traysPerStack: 20, stacksCount: "" },
  ],
  looseEntries: {
    good: [],
    cracked: [],
    broken: [],
    spoiled: [],
  },
  nextDaySell: "",
};

export function EggCalculator() {
  const validEggsPerTray = EGGS_PER_TRAY;
  const [stacks, setStacks] = useState<StackRow[]>([
    { id: "1", traysPerStack: 20, stacksCount: "" },
  ]);

  // Next Day Sell (Reserve / Carry-over Eggs)
  const [nextDaySell, setNextDaySell] = useState<number | "">("");

  // Multi-entry state for Outside / Loose egg categories
  const [looseEntries, setLooseEntries] = useState<Record<LooseCategoryKey, number[]>>({
    good: [],
    cracked: [],
    broken: [],
    spoiled: [],
  });

  const [looseDrafts, setLooseDrafts] = useState<Record<LooseCategoryKey, string>>({
    good: "",
    cracked: "",
    broken: "",
    spoiled: "",
  });

  // Modals state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<StackRow | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Restore from localStorage on initial mount with backward compatibility
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CalculatorState;
        if (Array.isArray(parsed.stacks) && parsed.stacks.length > 0) setStacks(parsed.stacks);

        if (parsed.looseEntries && typeof parsed.looseEntries === "object") {
          setLooseEntries({
            good: Array.isArray(parsed.looseEntries.good) ? parsed.looseEntries.good : [],
            cracked: Array.isArray(parsed.looseEntries.cracked) ? parsed.looseEntries.cracked : [],
            broken: Array.isArray(parsed.looseEntries.broken) ? parsed.looseEntries.broken : [],
            spoiled: Array.isArray(parsed.looseEntries.spoiled) ? parsed.looseEntries.spoiled : [],
          });
        } else {
          // Legacy single-number migration
          const migrateLegacy = (val: number | "" | undefined): number[] => {
            const num = Number(val);
            return !isNaN(num) && num > 0 ? [num] : [];
          };

          setLooseEntries({
            good: migrateLegacy(parsed.looseGood),
            cracked: migrateLegacy(parsed.looseCracked),
            broken: migrateLegacy(parsed.looseBroken),
            spoiled: migrateLegacy(parsed.looseSpoiled),
          });
        }

        if (parsed.nextDaySell !== undefined) {
          const nds = parsed.nextDaySell === "" ? "" : Number(parsed.nextDaySell);
          setNextDaySell(!isNaN(Number(nds)) ? nds : "");
        }
      }
    } catch (err) {
      console.warn("Failed to load calculator state from localStorage:", err);
    }
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    try {
      const state: CalculatorState = {
        eggsPerTray: EGGS_PER_TRAY,
        stacks,
        looseEntries,
        nextDaySell,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Failed to save calculator state to localStorage:", err);
    }
  }, [stacks, looseEntries, nextDaySell]);

  // Calculations

  // Step 1: Tray Stacks
  const stackRowsData = useMemo(() => {
    return stacks.map((row) => {
      const t = Number(row.traysPerStack) || 0;
      const s = Number(row.stacksCount) || 0;
      const rowTotalTrays = t * s;
      return {
        ...row,
        rowTotalTrays,
      };
    });
  }, [stacks]);

  const totalTrays = useMemo(() => {
    return stackRowsData.reduce((acc, row) => acc + row.rowTotalTrays, 0);
  }, [stackRowsData]);

  const totalTrayEggs = useMemo(() => {
    return totalTrays * validEggsPerTray;
  }, [totalTrays, validEggsPerTray]);

  // Step 2: Multi-entry Loose & Damaged Eggs Helpers
  const getCategoryTotal = useCallback(
    (key: LooseCategoryKey) => {
      const sum = (looseEntries[key] || []).reduce((a, b) => a + b, 0);
      const draftVal = parseInt(looseDrafts[key], 10);
      return sum + (!isNaN(draftVal) && draftVal > 0 ? draftVal : 0);
    },
    [looseEntries, looseDrafts]
  );

  const commitEntry = useCallback((key: LooseCategoryKey) => {
    const draft = looseDrafts[key];
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val > 0) {
      setLooseEntries((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), val],
      }));
      setLooseDrafts((prev) => ({ ...prev, [key]: "" }));
    }
  }, [looseDrafts]);

  const addDirectPreset = useCallback((key: LooseCategoryKey, amount: number) => {
    setLooseEntries((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), amount],
    }));
  }, []);

  const removeEntry = useCallback((key: LooseCategoryKey, index: number) => {
    setLooseEntries((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== index),
    }));
  }, []);

  const clearCategory = useCallback((key: LooseCategoryKey) => {
    setLooseEntries((prev) => ({ ...prev, [key]: [] }));
    setLooseDrafts((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const numLooseGood = useMemo(() => getCategoryTotal("good"), [getCategoryTotal]);
  const numLooseCracked = useMemo(() => getCategoryTotal("cracked"), [getCategoryTotal]);
  const numLooseBroken = useMemo(() => getCategoryTotal("broken"), [getCategoryTotal]);
  const numLooseSpoiled = useMemo(() => getCategoryTotal("spoiled"), [getCategoryTotal]);

  const totalLooseEggs = useMemo(() => {
    return numLooseGood + numLooseCracked + numLooseBroken + numLooseSpoiled;
  }, [numLooseGood, numLooseCracked, numLooseBroken, numLooseSpoiled]);

  // Next Day Sell (পরের দিনের বিক্রি) - Added (+) to calculations
  const nextDaySellEggs = useMemo(() => {
    return Math.max(0, Number(nextDaySell) || 0);
  }, [nextDaySell]);

  // Step 3: Grand Total Eggs (Tray Eggs + Loose Eggs + Next Day Sell)
  const grandTotalEggs = useMemo(() => {
    return totalTrayEggs + totalLooseEggs + nextDaySellEggs;
  }, [totalTrayEggs, totalLooseEggs, nextDaySellEggs]);

  // Step 4: Total Good Eggs (Tray Eggs + Good Loose + Next Day Sell)
  const totalGoodEggs = useMemo(() => {
    return totalTrayEggs + numLooseGood + nextDaySellEggs;
  }, [totalTrayEggs, numLooseGood, nextDaySellEggs]);

  // Step 5: Total Eggs Excluding Spoiled (Usable Eggs)
  const totalUsableEggs = useMemo(() => {
    return Math.max(0, grandTotalEggs - numLooseSpoiled);
  }, [grandTotalEggs, numLooseSpoiled]);

  // Step 6: Final Tray & Remainder Conversions
  const toTrayRemainder = useCallback(
    (totalCount: number) => {
      const fullTrays = Math.floor(totalCount / validEggsPerTray);
      const remainderEggs = totalCount % validEggsPerTray;
      return { fullTrays, remainderEggs };
    },
    [validEggsPerTray]
  );

  const grandTotalConversion = useMemo(
    () => toTrayRemainder(grandTotalEggs),
    [toTrayRemainder, grandTotalEggs]
  );

  const goodEggsConversion = useMemo(
    () => toTrayRemainder(totalGoodEggs),
    [toTrayRemainder, totalGoodEggs]
  );

  const usableEggsConversion = useMemo(
    () => toTrayRemainder(totalUsableEggs),
    [toTrayRemainder, totalUsableEggs]
  );

  const nextDayConversion = useMemo(
    () => toTrayRemainder(nextDaySellEggs),
    [toTrayRemainder, nextDaySellEggs]
  );

  // Stack Row Management
  const addStackRow = () => {
    const newId = Date.now().toString();
    setStacks((prev) => [
      ...prev,
      { id: newId, traysPerStack: 20, stacksCount: "" },
    ]);
  };

  const updateStackRow = (
    id: string,
    field: "traysPerStack" | "stacksCount",
    val: string
  ) => {
    const numVal = val === "" ? "" : Math.max(0, parseInt(val, 10) || 0);
    setStacks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: numVal } : r))
    );
  };

  const promptDeleteRow = (row: StackRow) => {
    const hasValues = (Number(row.traysPerStack) || 0) > 0 && (Number(row.stacksCount) || 0) > 0;
    if (hasValues) {
      setRowToDelete(row);
    } else {
      removeStackRow(row.id);
    }
  };

  const removeStackRow = (id: string) => {
    setStacks((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length > 0 ? filtered : [{ id: Date.now().toString(), traysPerStack: 20, stacksCount: "" }];
    });
    setRowToDelete(null);
  };

  // Reset All
  const handleReset = () => {
    setStacks([
      { id: Date.now().toString(), traysPerStack: 20, stacksCount: "" },
    ]);
    setLooseEntries({
      good: [],
      cracked: [],
      broken: [],
      spoiled: [],
    });
    setLooseDrafts({
      good: "",
      cracked: "",
      broken: "",
      spoiled: "",
    });
    setNextDaySell("");
    localStorage.removeItem(STORAGE_KEY);
    setIsResetModalOpen(false);
    toast.success("Calculator reset to initial defaults.");
  };

  // Copy Summary to Clipboard
  const handleCopySummary = async () => {
    try {
      const stacksBreakdown = stackRowsData
        .map(
          (r, idx) =>
            `  Stack ${idx + 1}: ${r.traysPerStack || 0} trays × ${r.stacksCount || 0} stacks = ${r.rowTotalTrays} Trays`
        )
        .join("\n");

      const formatCatLine = (label: string, key: LooseCategoryKey) => {
        const entries = looseEntries[key] || [];
        const draftVal = parseInt(looseDrafts[key], 10);
        const all = [...entries];
        if (!isNaN(draftVal) && draftVal > 0) all.push(draftVal);
        const total = all.reduce((a, b) => a + b, 0);
        if (all.length > 1) {
          return `• ${label}: ${total.toLocaleString()} pcs (${all.join(" + ")})`;
        }
        return `• ${label}: ${total.toLocaleString()} pcs`;
      };

      const text = `🥚 EGG INVENTORY CALCULATION REPORT
----------------------------------------------
Tray Standard: ${validEggsPerTray} Eggs / Tray

STEP 1: TRAY STACKS
${stacksBreakdown}
• Total Trays: ${totalTrays.toLocaleString()} Trays
• Total Tray Eggs: ${totalTrayEggs.toLocaleString()} pcs

STEP 2: LOOSE & DAMAGED EGGS
${formatCatLine("Loose Eggs", "good")}
${formatCatLine("Cracked / Laga", "cracked")}
${formatCatLine("Broken / Fata", "broken")}
${formatCatLine("Spoiled / Nosto", "spoiled")}
• Total Loose: ${totalLooseEggs.toLocaleString()} pcs
${nextDaySellEggs > 0 ? `
STEP 3: NEXT DAY SELL (পরের দিনের বিক্রি)
• Next Day Sell: +${nextDaySellEggs.toLocaleString()} pcs (${nextDayConversion.fullTrays} Trays, ${nextDayConversion.remainderEggs} Eggs)
` : ""}
----------------------------------------------
FINAL SUMMARY & CONVERSIONS
• Grand Total Eggs: ${grandTotalEggs.toLocaleString()} pcs (${grandTotalConversion.fullTrays} Trays, ${grandTotalConversion.remainderEggs} Eggs)
• Total Good Eggs: ${totalGoodEggs.toLocaleString()} pcs (${goodEggsConversion.fullTrays} Trays, ${goodEggsConversion.remainderEggs} Eggs)
${nextDaySellEggs > 0 ? `• Next Day Sell Added: +${nextDaySellEggs.toLocaleString()} pcs (${nextDayConversion.fullTrays} Trays, ${nextDayConversion.remainderEggs} Eggs)\n` : ""}• Total Usable (Excl. Spoiled): ${totalUsableEggs.toLocaleString()} pcs (${usableEggsConversion.fullTrays} Trays, ${usableEggsConversion.remainderEggs} Eggs)
----------------------------------------------
Generated by NextEgg Poultry ERP`;

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Calculation summary copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      toast.error("Failed to copy to clipboard.");
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Main Two-Column Grid: Inputs on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Tray Stacks & Loose/Damaged Categories (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Tray Stacks Card */}
          <Card className="rounded-xl border-border/70 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold text-foreground">
                Tray Stacks
              </CardTitle>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStackRow}
                className="h-7.5 px-2.5 text-xs font-semibold rounded-lg text-primary border-primary/30 hover:bg-primary/10 gap-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Stack</span>
              </Button>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-2">
              {/* Single Clean Table Column Header Row */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 border-b border-border/60">
                <span className="w-5 sm:w-6 text-center shrink-0">#</span>
                <span className="w-20 sm:w-28 text-center shrink-0 truncate">Trays/Stack</span>
                <span className="w-3 shrink-0 text-center">×</span>
                <span className="w-20 sm:w-28 text-center shrink-0 truncate">Stacks</span>
                <span className="flex-1 text-right pr-2 truncate">Total</span>
                <span className="w-8 shrink-0"></span>
              </div>

              {/* Single-Line Stack Rows */}
              <div className="divide-y divide-border/50">
                {stacks.map((row, index) => {
                  const t = Number(row.traysPerStack) || 0;
                  const s = Number(row.stacksCount) || 0;
                  const rowTotal = t * s;

                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-1.5 sm:gap-2 w-full flex-nowrap py-1.5 sm:py-2"
                    >
                      {/* Row Index */}
                      <span className="w-5 sm:w-6 text-center text-[11px] sm:text-xs font-mono font-medium text-muted-foreground shrink-0">
                        {index + 1}
                      </span>

                      {/* Trays per stack input */}
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder="20"
                        value={row.traysPerStack}
                        onChange={(e) => updateStackRow(row.id, "traysPerStack", e.target.value)}
                        className="w-20 sm:w-28 h-9 text-center text-xs sm:text-sm font-medium bg-background border-border/80 rounded-lg shrink-0 px-1"
                      />

                      {/* Multiply sign */}
                      <span className="w-3 text-center text-muted-foreground font-semibold text-xs sm:text-sm shrink-0">
                        ×
                      </span>

                      {/* Number of stacks input */}
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder="0"
                        value={row.stacksCount}
                        onChange={(e) => updateStackRow(row.id, "stacksCount", e.target.value)}
                        className="w-20 sm:w-28 h-9 text-center text-xs sm:text-sm font-medium bg-background border-border/80 rounded-lg shrink-0 px-1"
                      />

                      {/* Equals & Total Trays Result */}
                      <div className="flex-1 text-right font-bold text-sm sm:text-base whitespace-nowrap px-1 font-mono text-foreground">
                        <span className="text-muted-foreground font-normal text-xs sm:text-sm mr-1">=</span>
                        {rowTotal.toLocaleString()}
                        <span className="text-[10px] sm:text-xs font-normal text-muted-foreground ml-1 hidden min-[420px]:inline">
                          Trays
                        </span>
                      </div>

                      {/* Delete / Cross Icon Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => promptDeleteRow(row)}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        title="Delete stack row"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Subtotals Footer Bar */}
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 bg-muted/10 p-2 sm:p-2.5 rounded-lg mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>
                    Rows: <strong className="text-foreground">{stacks.length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono ml-auto">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Total Trays: </span>
                    <strong className="text-xs sm:text-sm font-black text-teal-600 dark:text-teal-400">
                      {totalTrays.toLocaleString()}
                    </strong>
                  </div>
                  <div className="border-l border-border/60 pl-3">
                    <span className="text-muted-foreground text-[11px]">Tray Eggs: </span>
                    <strong className="text-xs sm:text-sm font-black text-foreground">
                      {totalTrayEggs.toLocaleString()} <span className="text-[10px] font-normal">pcs</span>
                    </strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loose & Damaged Eggs Card */}
          <Card className="rounded-xl border-border/70 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold text-foreground">
                Loose & Damaged Eggs
              </CardTitle>

              <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 font-semibold">
                Total: {totalLooseEggs.toLocaleString()} pcs
              </Badge>
            </CardHeader>

            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LOOSE_CATEGORIES.map((cat) => {
                  const entries = looseEntries[cat.key] || [];
                  const draft = looseDrafts[cat.key] || "";
                  const total = getCategoryTotal(cat.key);

                  return (
                    <div
                      key={cat.key}
                      className="p-2.5 sm:p-3 rounded-xl border border-border/60 bg-muted/15 space-y-2"
                    >
                      {/* Header: Label & Running Total Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`h-2.5 w-2.5 rounded-full ${cat.dotColor} shrink-0`} />
                          <span className="text-xs font-bold text-foreground truncate">
                            {cat.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5 font-bold">
                            Total: {total.toLocaleString()}
                          </Badge>
                          {(entries.length > 0 || draft !== "") && (
                            <button
                              type="button"
                              onClick={() => clearCategory(cat.key)}
                              className="text-[10px] text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                              title="Clear category"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Single-Line Entry Row: Input + Quick Add + Quick Presets */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          placeholder="Add count..."
                          value={draft}
                          onChange={(e) =>
                            setLooseDrafts((prev) => ({ ...prev, [cat.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEntry(cat.key);
                            }
                          }}
                          className="h-8 text-xs font-semibold bg-background border-border/80 rounded-lg flex-1 min-w-0 px-2"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => commitEntry(cat.key)}
                          disabled={!draft || parseInt(draft, 10) <= 0}
                          className="h-8 px-2 text-xs font-semibold rounded-lg shrink-0 gap-1 border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-40"
                          title="Add entry (or press Enter)"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </Button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => addDirectPreset(cat.key, 1)}
                            className="h-8 px-1.5 text-[10px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                            title="Add +1 egg"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => addDirectPreset(cat.key, 5)}
                            className="h-8 px-1.5 text-[10px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                            title="Add +5 eggs"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => addDirectPreset(cat.key, 10)}
                            className="h-8 px-1.5 text-[10px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                            title="Add +10 eggs"
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* Interactive Entry Pills / Chips */}
                      {entries.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {entries.map((num, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-background border border-border/80 text-foreground font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md shadow-2xs"
                            >
                              <span>+{num}</span>
                              <button
                                type="button"
                                onClick={() => removeEntry(cat.key, idx)}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                title="Remove this entry"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Next Day Sell (Reserved / Carry-over Eggs) Card */}
          {/* Next Day Sell (পরের দিনের বিক্রি) Card */}
          <Card className="rounded-xl border-border/70 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <CardTitle className="text-sm font-bold text-foreground">
                  Next Day Sell
                </CardTitle>
                <span className="text-[11px] text-muted-foreground font-normal">
                  (পরের দিনের বিক্রি)
                </span>
              </div>

              <Badge
                variant="outline"
                className="font-mono text-xs px-2 py-0.5 font-semibold text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10"
              >
                +{nextDaySellEggs.toLocaleString()} pcs
              </Badge>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={nextDaySell}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNextDaySell(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                    }}
                    className="h-8.5 text-xs font-semibold bg-background border-border/80 rounded-lg pr-10"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none">
                    pcs
                  </span>
                </div>

                {/* Preset Quick Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setNextDaySell((prev) => (Number(prev) || 0) + 10)}
                    className="h-8.5 px-2 text-[11px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                    title="Add 10 eggs"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextDaySell((prev) => (Number(prev) || 0) + 30)}
                    className="h-8.5 px-2 text-[11px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                    title="Add 1 tray (30 eggs)"
                  >
                    +30 (1T)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextDaySell((prev) => (Number(prev) || 0) + 60)}
                    className="h-8.5 px-2 text-[11px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/40"
                    title="Add 2 trays (60 eggs)"
                  >
                    +60 (2T)
                  </button>
                  {nextDaySell !== "" && Number(nextDaySell) > 0 && (
                    <button
                      type="button"
                      onClick={() => setNextDaySell("")}
                      className="h-8.5 px-2 text-[11px] font-semibold rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border/40"
                      title="Clear next day sell"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Tray equivalent indicator */}
              {nextDaySellEggs > 0 && (
                <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-purple-500/10 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  <span className="flex items-center gap-1">
                    <BookmarkCheck className="h-3 w-3" />
                    <span>Tray Conversion:</span>
                  </span>
                  <span className="font-bold">
                    {nextDayConversion.fullTrays.toLocaleString()} Trays, {nextDayConversion.remainderEggs} Eggs
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Calculation Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-xl border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card shadow-xs overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-primary/20 bg-primary/5 pb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Calculation Summary
                </span>
                <Package className="h-4 w-4 text-primary" />
              </div>

              {/* Main Prominent Final Result (Trays + Eggs) */}
              <div className="mt-2.5 space-y-0.5">
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {grandTotalConversion.fullTrays.toLocaleString()}{" "}
                  <span className="text-base sm:text-lg font-semibold text-muted-foreground">Trays,</span>{" "}
                  {grandTotalConversion.remainderEggs}{" "}
                  <span className="text-base sm:text-lg font-semibold text-muted-foreground">Eggs</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Grand Total: <strong className="text-foreground font-bold">{grandTotalEggs.toLocaleString()}</strong> pieces
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-3">
              {/* Total Good Eggs */}
              <div className="p-2.5 sm:p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Total Good Eggs</span>
                  </div>
                  <span className="font-mono text-sm font-black">
                    {totalGoodEggs.toLocaleString()} pcs
                  </span>
                </div>
                <div className="pt-1 border-t border-emerald-500/20 text-xs font-mono font-bold text-foreground flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Tray Conversion:</span>
                  <span>
                    {goodEggsConversion.fullTrays.toLocaleString()} Trays, {goodEggsConversion.remainderEggs} Eggs
                  </span>
                </div>
              </div>

              {/* Next Day Sell (পরের দিনের বিক্রি) Card (When > 0) */}
              {nextDaySellEggs > 0 && (
                <div className="p-2.5 sm:p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 dark:bg-purple-950/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>Next Day Sell (পরের দিনের বিক্রি)</span>
                    </div>
                    <span className="font-mono text-sm font-black text-purple-600 dark:text-purple-400">
                      +{nextDaySellEggs.toLocaleString()} pcs
                    </span>
                  </div>
                  <div className="pt-1 border-t border-purple-500/20 text-xs font-mono font-bold text-foreground flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Tray Conversion:</span>
                    <span>
                      {nextDayConversion.fullTrays.toLocaleString()} Trays, {nextDayConversion.remainderEggs} Eggs
                    </span>
                  </div>
                </div>
              )}

              {/* Total Usable Eggs (Excluding Spoiled) */}
              <div className="p-2.5 sm:p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 dark:bg-blue-950/20 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>Usable Eggs (Excl. Spoiled)</span>
                  </div>
                  <span className="font-mono text-sm font-black">
                    {totalUsableEggs.toLocaleString()} pcs
                  </span>
                </div>
                <div className="pt-1 border-t border-blue-500/20 text-xs font-mono font-bold text-foreground flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Tray Conversion:</span>
                  <span>
                    {usableEggsConversion.fullTrays.toLocaleString()} Trays, {usableEggsConversion.remainderEggs} Eggs
                  </span>
                </div>
              </div>

              {/* Calculation Breakdown Table */}
              <div className="border border-border/70 rounded-lg overflow-hidden text-xs">
                <div className="bg-muted/30 px-3 py-1.5 font-bold text-foreground border-b border-border/60 text-[11px]">
                  Calculation Breakdown
                </div>
                <div className="divide-y divide-border/40 font-mono text-[11px]">
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Tray Eggs:</span>
                    <span className="font-semibold">{totalTrayEggs.toLocaleString()} pcs ({totalTrays} Trays)</span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Loose Eggs:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{numLooseGood.toLocaleString()} pcs</span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Cracked / Laga:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">+{numLooseCracked.toLocaleString()} pcs</span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Broken / Fata:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">+{numLooseBroken.toLocaleString()} pcs</span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Spoiled / Nosto:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">+{numLooseSpoiled.toLocaleString()} pcs</span>
                  </div>
                  {nextDaySellEggs > 0 && (
                    <div className="px-3 py-1.5 flex items-center justify-between text-purple-600 dark:text-purple-400 font-bold">
                      <span>Next Day Sell (পরের দিনের বিক্রি):</span>
                      <span>+{nextDaySellEggs.toLocaleString()} pcs</span>
                    </div>
                  )}
                  <div className="px-3 py-1.5 flex items-center justify-between bg-muted/20 font-bold text-xs">
                    <span className="text-foreground">Grand Total:</span>
                    <span className="text-primary">{grandTotalEggs.toLocaleString()} pcs</span>
                  </div>
                </div>
              </div>

              {/* Actions: Copy Summary & Reset All */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="flex-1 h-8.5 text-xs font-semibold rounded-lg gap-1.5"
                  title="Copy formatted summary to clipboard"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? "Copied" : "Copy Summary"}</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsResetModalOpen(true)}
                  className="h-8.5 px-3 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1.5"
                  title="Reset all inputs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal: Delete Stack Row */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm bg-card border border-border/80 shadow-2xl rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-destructive">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground leading-none">Delete Stack Row</h3>
                <p className="text-xs text-muted-foreground mt-1">This row contains active numbers.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove this stack row ({rowToDelete.traysPerStack || 0} trays × {rowToDelete.stacksCount || 0} stacks = {(Number(rowToDelete.traysPerStack) || 0) * (Number(rowToDelete.stacksCount) || 0)} Trays)?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRowToDelete(null)}
                className="h-8.5 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeStackRow(rowToDelete.id)}
                className="h-8.5 rounded-xl text-xs font-semibold"
              >
                Delete Row
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset All */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm bg-card border border-border/80 shadow-2xl rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground leading-none">Reset Calculator</h3>
                <p className="text-xs text-muted-foreground mt-1">Clear all counts and stacks.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to reset all calculations? This will clear all tray stacks and loose egg counts back to defaults.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetModalOpen(false)}
                className="h-8.5 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleReset}
                className="h-8.5 rounded-xl text-xs font-semibold"
              >
                Reset Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
