"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  X,
  Package,
  BookmarkCheck,
  History,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/api";
import { ProductItem } from "@/types/product";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LooseCategoryKey,
  StackRow,
  CalculatorState,
  CalculatorHistoryEntry,
  EGGS_PER_TRAY,
  readCalculatorState,
  writeCalculatorState,
  clearCalculatorState,
  readCalculatorHistory,
  writeCalculatorHistory,
  normalizeLooseEntries,
  formatStockVerificationText,
} from "./egg-calculator-storage";

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

export function EggCalculator() {
  const router = useRouter();
  const validEggsPerTray = EGGS_PER_TRAY;
  const hasHydratedRef = useRef(false);
  const [stacks, setStacks] = useState<StackRow[]>([
    { id: "1", traysPerStack: 20, stacksCount: "" },
  ]);

  // Product selection & verification state
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Fetch active products for optional stock verification (Read-only)
  const { data: productsData } = useQuery({
    queryKey: ["calculator-products"],
    queryFn: () => productService.getProducts({ size: 100, status: "active" }),
    staleTime: 60 * 1000,
  });
  const products: ProductItem[] = useMemo(() => {
    if (!productsData) return [];
    if (productsData.data?.items && Array.isArray(productsData.data.items)) {
      return productsData.data.items;
    }
    return [];
  }, [productsData]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

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
    const parsed = readCalculatorState();
    if (parsed) {
      if (Array.isArray(parsed.stacks) && parsed.stacks.length > 0) {
        setStacks(parsed.stacks);
      }

      if (parsed.selectedProductId) {
        setSelectedProductId(parsed.selectedProductId);
      }

      if (parsed.looseEntries && typeof parsed.looseEntries === "object") {
        setLooseEntries(normalizeLooseEntries(parsed.looseEntries));
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
    hasHydratedRef.current = true;
  }, []);

  // Persist to localStorage on state change (after initial hydration)
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const state: CalculatorState = {
      eggsPerTray: EGGS_PER_TRAY,
      stacks,
      looseEntries,
      nextDaySell,
      selectedProductId,
    };
    writeCalculatorState(state);
  }, [stacks, looseEntries, nextDaySell, selectedProductId]);

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

  // Step 4: Final Tray & Remainder Conversions
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

  const nextDayConversion = useMemo(
    () => toTrayRemainder(nextDaySellEggs),
    [toTrayRemainder, nextDaySellEggs]
  );

  const stockDifference = useMemo(() => {
    if (!selectedProduct) return null;
    return grandTotalEggs - (selectedProduct.current_stock ?? 0);
  }, [selectedProduct, grandTotalEggs]);

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
    setSelectedProductId("");
    clearCalculatorState();
    setIsResetModalOpen(false);
    toast.success("Calculator reset to initial defaults.");
  };

  // Copy Summary to Clipboard
  const handleCopySummary = async () => {
    try {
      const stacksBreakdown = stackRowsData
        .map((r) => `${r.traysPerStack || 0} × ${r.stacksCount || 0} = ${r.rowTotalTrays}`)
        .join("\n");

      const looseLines: string[] = [];
      if (numLooseGood > 0) looseLines.push(`+ খোলা ডিম: ${numLooseGood.toLocaleString()} টি`);
      if (numLooseCracked > 0) looseLines.push(`+ ফাটা/লাগা ডিম: ${numLooseCracked.toLocaleString()} টি`);
      if (numLooseBroken > 0) looseLines.push(`+ ভাঙা ডিম: ${numLooseBroken.toLocaleString()} টি`);
      if (numLooseSpoiled > 0) looseLines.push(`+ নষ্ট ডিম: ${numLooseSpoiled.toLocaleString()} টি`);
      if (nextDaySellEggs > 0) looseLines.push(`+ পরের দিনের বিক্রি: ${nextDaySellEggs.toLocaleString()} টি`);

      const stockVerificationText = formatStockVerificationText(
        selectedProduct?.name,
        selectedProduct?.current_stock,
        grandTotalEggs
      );

      const text = `🥚 ডিমের হিসাব বিবরণী
------------------------------
${stacksBreakdown}
------------------------------
মোট ট্রে: ${totalTrays.toLocaleString()} ট্রে

ট্রে ডিম: ${totalTrays} × ${validEggsPerTray} = ${totalTrayEggs.toLocaleString()} টি
${looseLines.length > 0 ? `\n${looseLines.join("\n")}\n` : ""}------------------------------
সর্বমোট ডিম: ${grandTotalEggs.toLocaleString()} টি
ট্রে হিসেবে: ${grandTotalConversion.fullTrays} ট্রে, ${grandTotalConversion.remainderEggs} ডিম${stockVerificationText}
------------------------------
Akota Poultry`;

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("হিসাবের সারসংক্ষেপ কপি করা হয়েছে!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  // History Management
  const handleSaveToHistory = () => {
    if (grandTotalEggs <= 0 && totalTrays <= 0) {
      toast.error("হিসাব খালি! অন্তত কিছু ডিম বা ট্রে যোগ করে সেভ করুন।");
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleString("bn-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const newEntry: CalculatorHistoryEntry = {
      id: Date.now().toString(),
      createdAt: now.toISOString(),
      formattedDate,
      productId: selectedProduct?.id,
      productName: selectedProduct?.name,
      systemStock: selectedProduct?.current_stock ?? null,
      stacks: JSON.parse(JSON.stringify(stacks)),
      looseEntries: JSON.parse(JSON.stringify(looseEntries)),
      nextDaySell,
      totalTrays,
      totalTrayEggs,
      totalLooseEggs,
      nextDaySellEggs,
      grandTotalEggs,
      grandTotalConversion: { ...grandTotalConversion },
      stockDifference: stockDifference ?? null,
    };

    const existingHistory = readCalculatorHistory();
    writeCalculatorHistory([newEntry, ...existingHistory]);
    toast.success("হিসাবটি সফলভাবে হিস্ট্রিতে সংরক্ষণ করা হয়েছে!", {
      action: {
        label: "হিস্ট্রি দেখুন",
        onClick: () => router.push("/calculators/history"),
      },
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
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
          <Card className="rounded-xl border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    গণনার সারসংক্ষেপ (Summary)
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                  {validEggsPerTray} ডিম / ট্রে
                </Badge>
              </div>

              {/* Optional Product Selection & Real Stock Indicator */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <span>পণ্য নির্বাচন (ঐচ্ছিক স্টক যাচাই):</span>
                  </label>
                  {selectedProduct && (
                    <Badge variant="outline" className="text-[11px] font-mono font-semibold text-primary border-primary/30 bg-primary/5">
                      বর্তমান স্টক: {selectedProduct.current_stock.toLocaleString()} টি
                    </Badge>
                  )}
                </div>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full h-8.5 text-xs font-medium bg-background border border-border/80 rounded-lg px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- সাধারণ গণনা (কোনো পণ্য ছাড়া) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (বর্তমান স্টক: {p.current_stock.toLocaleString()} টি)
                    </option>
                  ))}
                </select>
              </div>

              {/* Main Prominent Final Result (Trays + Eggs) */}
              <div className="pt-2 border-t border-border/50">
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {grandTotalConversion.fullTrays.toLocaleString()}{" "}
                  <span className="text-base sm:text-lg font-semibold text-muted-foreground">ট্রে,</span>{" "}
                  {grandTotalConversion.remainderEggs}{" "}
                  <span className="text-base sm:text-lg font-semibold text-muted-foreground">ডিম</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  সর্বমোট ডিম: <strong className="text-foreground font-bold">{grandTotalEggs.toLocaleString()}</strong> টি
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 sm:p-4 space-y-3">
              {/* Step-by-Step Arithmetic Ledger (ধাপে ধাপে হিসাব) */}
              <div className="font-mono text-xs sm:text-sm divide-y divide-border/60">
                {/* 1. Tray Stacks Breakdown */}
                <div className="pb-2.5 space-y-1">
                  <div className="text-[11px] font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    ট্রে খাঁচার হিসাব (Tray Stacks)
                  </div>
                  <div className="space-y-1 pl-1">
                    {stackRowsData.map((r, idx) => {
                      const t = Number(r.traysPerStack) || 0;
                      const s = Number(r.stacksCount) || 0;
                      return (
                        <div key={r.id || idx} className="flex items-center justify-between text-foreground">
                          <span>
                            {t} <span className="text-muted-foreground font-normal">×</span> {s}
                          </span>
                          <span className="font-bold">
                            = {r.rowTotalTrays.toLocaleString()} <span className="text-[11px] text-muted-foreground font-normal">ট্রে</span>
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-1 flex items-center justify-between font-bold text-teal-600 dark:text-teal-400 border-t border-dashed border-border/60">
                      <span>মোট ট্রে</span>
                      <span>= {totalTrays.toLocaleString()} ট্রে</span>
                    </div>
                  </div>
                </div>

                {/* 2. Tray to Eggs Conversion */}
                <div className="py-2.5 space-y-1">
                  <div className="text-[11px] font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    ট্রে থেকে ডিমের সংখ্যা
                  </div>
                  <div className="flex items-center justify-between text-foreground pl-1 font-bold">
                    <span>
                      {totalTrays} <span className="text-muted-foreground font-normal">×</span> {validEggsPerTray}
                    </span>
                    <span>= {totalTrayEggs.toLocaleString()} টি ডিম</span>
                  </div>
                </div>

                {/* 3. Loose & Damaged Eggs Breakdown */}
                {(totalLooseEggs > 0 || nextDaySellEggs > 0) && (
                  <div className="py-2.5 space-y-1">
                    <div className="text-[11px] font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      খোলা ও অতিরিক্ত ডিম
                    </div>
                    <div className="space-y-1 pl-1">
                      {numLooseGood > 0 && (
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            + খোলা ডিম (Loose)
                          </span>
                          <span className="font-bold">+{numLooseGood.toLocaleString()} টি</span>
                        </div>
                      )}
                      {numLooseCracked > 0 && (
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            + ফাটা / লাগা (Cracked)
                          </span>
                          <span className="font-bold">+{numLooseCracked.toLocaleString()} টি</span>
                        </div>
                      )}
                      {numLooseBroken > 0 && (
                        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            + ভাঙা ডিম (Broken)
                          </span>
                          <span className="font-bold">+{numLooseBroken.toLocaleString()} টি</span>
                        </div>
                      )}
                      {numLooseSpoiled > 0 && (
                        <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-600 shrink-0" />
                            + নষ্ট ডিম (Spoiled)
                          </span>
                          <span className="font-bold">+{numLooseSpoiled.toLocaleString()} টি</span>
                        </div>
                      )}
                      {nextDaySellEggs > 0 && (
                        <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                            + পরের দিনের বিক্রি
                          </span>
                          <span className="font-bold">+{nextDaySellEggs.toLocaleString()} টি</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Stock Match Verification (Only when a product is selected) */}
                {selectedProduct && (
                  <div className="pt-2.5 space-y-1.5 font-sans">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>স্টক যাচাই (Stock Verification)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">(শুধুমাত্র তুলনার জন্য)</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>সিস্টেমের বর্তমান স্টক:</span>
                        <span className="font-bold text-foreground">{selectedProduct.current_stock.toLocaleString()} টি</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>গণনাকৃত সর্বমোট ডিম:</span>
                        <span className="font-bold text-foreground">{grandTotalEggs.toLocaleString()} টি</span>
                      </div>
                      <div className="border-t border-border/60 pt-1.5 flex items-center justify-between font-sans">
                        <span className="font-bold text-foreground text-xs">স্টক ব্যবধান (Gap):</span>
                        {stockDifference === 0 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs gap-1">
                            <Check className="h-3 w-3" />
                            <span>হুবহু মিলে গেছে</span>
                          </Badge>
                        ) : (stockDifference || 0) < 0 ? (
                          <Badge variant="destructive" className="font-bold text-xs">
                            {stockDifference?.toLocaleString()} টি ঘাটতি (Shortage)
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs">
                            +{stockDifference?.toLocaleString()} টি অতিরিক্ত (Surplus)
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-0.5 font-sans">
                        🔒 শুধুমাত্র গণনার জন্য। আসল প্রোডাক্ট স্টকে কোনো প্রভাব পড়বে না।
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions: Save History, Copy Summary, Reset All */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSaveToHistory}
                  className="w-full h-9 text-xs font-bold rounded-lg gap-1.5 shadow-xs"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>হিস্ট্রিতে সংরক্ষণ করুন (Save History)</span>
                </Button>

                <div className="flex items-center gap-2">
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
                    <span>Reset</span>
                  </Button>
                </div>
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
