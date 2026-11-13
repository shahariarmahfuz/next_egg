"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  RotateCcw,
  Copy,
  CalendarDays,
  History,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Database,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomSelect } from "@/components/ui/custom-select";
import { calculatorService } from "@/services/api";
import { useAuth } from "@/providers/auth-provider";
import {
  CalculatorHistoryCreatePayload,
  CalculatorHistoryItem,
} from "@/types/calculator";
import { getBusinessTimeZone, getTodayDateStr } from "@/utils/business-date";
import {
  LegacyLocalCalculatorHistoryEntry,
  readLegacyLocalHistory,
  clearLegacyLocalHistory,
  loadDbHistoryEntryIntoCalculatorState,
  formatStockVerificationText,
} from "./egg-calculator-storage";

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getTodayDateStr();
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function formatCalculationDate(isoString: string): string {
  try {
    const tz = getBusinessTimeZone();
    return new Date(isoString).toLocaleString("bn-BD", {
      timeZone: tz,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(isoString).toLocaleString("bn-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}

export function EggCalculatorHistory() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const todayStr = getTodayDateStr();
  const [filterMode, setFilterMode] = useState<"daily" | "all">("daily");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [legacyEntries, setLegacyEntries] = useState<LegacyLocalCalculatorHistoryEntry[]>([]);

  useEffect(() => {
    setLegacyEntries(readLegacyLocalHistory());
  }, []);

  const businessTz = getBusinessTimeZone();

  const { data: historyResponse, isLoading, isFetching } = useQuery({
    queryKey: [
      "calculator-history",
      userId,
      filterMode,
      selectedDate,
      productFilter,
      businessTz,
    ],
    queryFn: () =>
      calculatorService.getHistory({
        calculator_type: "egg",
        target_date: filterMode === "daily" ? selectedDate : undefined,
        show_all: filterMode === "all",
        product_name: productFilter !== "all" ? productFilter : undefined,
        timezone: businessTz,
        page: 1,
        size: 100,
      }),
    enabled: Boolean(userId),
  });

  const historyItems: CalculatorHistoryItem[] = useMemo(() => {
    return historyResponse?.data?.items ?? [];
  }, [historyResponse]);

  const productOptions: string[] = useMemo(() => {
    const aggOpts = historyResponse?.data?.aggregate?.product_options;
    if (Array.isArray(aggOpts)) {
      return aggOpts;
    }
    const names = new Set<string>();
    historyItems.forEach((item) => {
      if (item.product_name) names.add(item.product_name);
    });
    return Array.from(names);
  }, [historyResponse, historyItems]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calculatorService.deleteHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-history"] });
      toast.success("হিস্ট্রি আইটেম মুছে ফেলা হয়েছে।");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "মুছে ফেলতে সমস্যা হয়েছে।");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      calculatorService.clearHistory({
        calculator_type: "egg",
        target_date: filterMode === "daily" ? selectedDate : undefined,
        show_all: filterMode === "all",
        timezone: businessTz,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-history"] });
      toast.success("নির্বাচিত হিস্ট্রি মুছে ফেলা হয়েছে।");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "হিস্ট্রি মুছতে সমস্যা হয়েছে।");
    },
  });

  const importLegacyMutation = useMutation({
    mutationFn: async (entries: LegacyLocalCalculatorHistoryEntry[]) => {
      for (const entry of entries) {
        const payload: CalculatorHistoryCreatePayload = {
          calculator_type: "egg",
          calculation_date: entry.createdAt || new Date().toISOString(),
          product_id: entry.productId ?? null,
          product_name: entry.productName ?? null,
          system_stock: entry.systemStock ?? null,
          eggs_per_tray: 30,
          stacks: entry.stacks || [],
          loose_entries: entry.looseEntries || {
            good: [],
            cracked: [],
            broken: [],
            spoiled: [],
          },
          next_day_sell: Number(entry.nextDaySell) || 0,
          total_trays: entry.totalTrays || 0,
          total_tray_eggs: entry.totalTrayEggs || 0,
          total_loose_eggs: entry.totalLooseEggs || 0,
          next_day_sell_eggs: entry.nextDaySellEggs || 0,
          grand_total_eggs: entry.grandTotalEggs || 0,
          full_trays: entry.grandTotalConversion?.fullTrays || 0,
          remainder_eggs: entry.grandTotalConversion?.remainderEggs || 0,
          stock_difference: entry.stockDifference ?? null,
        };
        await calculatorService.createHistory(payload);
      }
    },
    onSuccess: () => {
      clearLegacyLocalHistory();
      setLegacyEntries([]);
      queryClient.invalidateQueries({ queryKey: ["calculator-history"] });
      toast.success("পুরোনো লোকাল হিস্ট্রি আপনার ডাটাবেসে যুক্ত করা হয়েছে!");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "লোকাল হিস্ট্রি ইমপোর্ট করতে সমস্যা হয়েছে।"
      );
    },
  });

  const handleLoadFromHistory = (entry: CalculatorHistoryItem) => {
    loadDbHistoryEntryIntoCalculatorState(entry, userId);
    toast.success("হিসাবটি ক্যালকুলেটরে লোড করা হয়েছে!");
    router.push("/calculators/egg");
  };

  const handleClearFilteredHistory = () => {
    const confirmMsg =
      filterMode === "daily"
        ? `আপনি কি নিশ্চিত যে ${selectedDate} তারিখের সকল সংরক্ষিত হিস্ট্রি মুছে ফেলতে চান?`
        : "আপনি কি নিশ্চিত যে আপনার সকল তারিখের সংরক্ষিত হিস্ট্রি মুছে ফেলতে চান?";

    if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
      clearMutation.mutate();
    }
  };

  const handleCopyHistoryItem = async (entry: CalculatorHistoryItem) => {
    try {
      const stacksBreakdown = (entry.stacks || [])
        .map(
          (r) =>
            `${r.traysPerStack || 0} × ${r.stacksCount || 0} = ${
              (Number(r.traysPerStack) || 0) * (Number(r.stacksCount) || 0)
            }`
        )
        .join("\n");

      const stockVerificationText = formatStockVerificationText(
        entry.product_name,
        entry.system_stock,
        entry.grand_total_eggs,
        entry.stock_difference
      );

      const formattedDate = formatCalculationDate(entry.calculation_date);
      const text = `🥚 ডিমের হিসাব বিবরণী (${formattedDate})
------------------------------
${stacksBreakdown}
------------------------------
মোট ট্রে: ${entry.total_trays.toLocaleString()} ট্রে
ট্রে ডিম: ${entry.total_tray_eggs.toLocaleString()} টি
খোলা ডিম: ${entry.total_loose_eggs.toLocaleString()} টি
------------------------------
সর্বমোট ডিম: ${entry.grand_total_eggs.toLocaleString()} টি
ট্রে হিসেবে: ${entry.full_trays} ট্রে, ${entry.remainder_eggs} ডিম${stockVerificationText}
------------------------------
Akota Poultry`;

      await navigator.clipboard.writeText(text);
      toast.success("হিসাব ক্লিপবোর্ডে কপি করা হয়েছে!");
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const isTodaySelected = filterMode === "daily" && selectedDate === todayStr;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Optional One-Time Migration Banner for Previous LocalStorage History */}
      {legacyEntries.length > 0 && (
        <Card className="rounded-xl border-amber-500/40 bg-amber-500/10 shadow-xs">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Database className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-foreground">
                  এই ব্রাউজারে পূর্বে সংরক্ষিত {legacyEntries.length}টি অফলাইন হিস্ট্রি পাওয়া গেছে
                </p>
                <p className="text-muted-foreground mt-0.5">
                  আপনার অ্যাকাউন্টের ডাটাবেসে যুক্ত করতে চাইলে &quot;ডাটাবেসে সেভ করুন&quot; চাপুন।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => importLegacyMutation.mutate(legacyEntries)}
                disabled={importLegacyMutation.isPending}
                className="h-8 text-xs font-semibold rounded-lg gap-1"
              >
                {importLegacyMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>ডাটাবেসে সেভ করুন</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearLegacyLocalHistory();
                  setLegacyEntries([]);
                }}
                disabled={importLegacyMutation.isPending}
                className="h-8 text-xs text-muted-foreground rounded-lg"
              >
                বাদ দিন
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-border/70 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">ক্যালকুলেটর হিস্ট্রি লগ</span>
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-mono shrink-0">
                {historyItems.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 min-w-0">
              <UserIcon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">
                {user?.full_name || user?.username || "User"} — ব্যক্তিগত হিসাব
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/calculators/egg")}
              className="h-8 text-xs font-semibold rounded-lg gap-1.5"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Egg Calculator</span>
            </Button>

            {historyItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilteredHistory}
                disabled={clearMutation.isPending}
                className="h-8 text-xs text-muted-foreground hover:text-destructive border-border/70 rounded-lg gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{filterMode === "daily" ? "এই দিনের সব মুছুন" : "সব মুছুন"}</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Organized Date & Product Filter Toolbar */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-2 sm:p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            {/* Date Navigation Row */}
            <div className="flex items-center gap-1.5 w-full lg:w-auto">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  setFilterMode("daily");
                  setSelectedDate((prev) => shiftDateStr(prev, -1));
                  setProductFilter("all");
                }}
                className="h-8.5 w-8.5 shrink-0 rounded-lg bg-background"
                title="আগের দিন"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedDate(val);
                    setFilterMode("daily");
                    setProductFilter("all");
                  }
                }}
                className={`h-8.5 flex-1 min-w-0 lg:w-[148px] lg:flex-initial text-xs font-semibold rounded-lg px-2 bg-background ${
                  filterMode === "daily"
                    ? "border-primary/50"
                    : "opacity-70"
                }`}
              />

              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  setFilterMode("daily");
                  setSelectedDate((prev) => shiftDateStr(prev, 1));
                  setProductFilter("all");
                }}
                className="h-8.5 w-8.5 shrink-0 rounded-lg bg-background"
                title="পরের দিন"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                size="sm"
                variant={isTodaySelected ? "secondary" : "outline"}
                onClick={() => {
                  setFilterMode("daily");
                  setSelectedDate(getTodayDateStr());
                  setProductFilter("all");
                }}
                className={`h-8.5 px-2.5 text-xs font-semibold rounded-lg shrink-0 ${
                  isTodaySelected
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
                    : "bg-background"
                }`}
              >
                আজ
              </Button>
            </div>

            {/* Mode Segmented Toggle + Product Filter */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="inline-grid grid-cols-2 p-0.5 rounded-lg bg-background border border-border/70 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("daily");
                    setProductFilter("all");
                  }}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-md transition-colors ${
                    filterMode === "daily"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  দৈনিক
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("all");
                    setProductFilter("all");
                  }}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-md transition-colors ${
                    filterMode === "all"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  সব তারিখ
                </button>
              </div>

              <CustomSelect
                value={productFilter}
                onValueChange={setProductFilter}
                options={[
                  { value: "all", label: "পণ্য: সকল পণ্য" },
                  ...productOptions.map((name) => ({
                    value: name,
                    label: name,
                  })),
                ]}
                placeholder="পণ্য: সকল পণ্য"
                searchPlaceholder="পণ্য খুঁজুন..."
                emptyText="কোনো পণ্য পাওয়া যায়নি"
                ariaLabel="পণ্য ফিল্টার"
                className="flex-1 min-w-0 lg:w-44 lg:flex-initial"
                triggerClassName="h-8.5 text-xs font-medium rounded-lg border-border/70"
              />

              {isFetching && !isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          </div>

          {/* History Items List */}
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">হিস্ট্রি লোড হচ্ছে...</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h4 className="text-sm font-semibold text-foreground">
                {filterMode === "daily"
                  ? `${selectedDate} তারিখে কোনো সংরক্ষিত হিস্ট্রি নেই`
                  : "কোনো সংরক্ষিত হিস্ট্রি নেই"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                ক্যালকুলেটরে হিসাব করার পর &quot;হিস্ট্রিতে সংরক্ষণ করুন&quot; বাটনে ক্লিক করলে তা আপনার অ্যাকাউন্টে তারিখ অনুযায়ী সংরক্ষিত থাকবে।
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {filterMode === "daily" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterMode("all")}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    সকল তারিখের হিস্ট্রি দেখুন
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/calculators/egg")}
                  className="h-8 text-xs font-semibold rounded-lg"
                >
                  ক্যালকুলেটরে যান
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 rounded-xl border border-border/70 bg-muted/10 hover:bg-muted/20 transition-colors space-y-2.5"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{formatCalculationDate(item.calculation_date)}</span>
                      </span>
                      {item.product_name ? (
                        <Badge
                          variant="secondary"
                          className="font-semibold text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          {item.product_name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          সাধারণ গণনা
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadFromHistory(item)}
                        className="h-7.5 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 rounded-lg gap-1"
                        title="এই হিসাবটি ক্যালকুলেটরে লোড করুন"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>লোড করুন</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyHistoryItem(item)}
                        className="h-7.5 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                        title="কপি করুন"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="h-7.5 px-2 text-xs text-muted-foreground hover:text-destructive rounded-lg"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Item Body: Result & Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono bg-background p-2.5 rounded-lg border border-border/50">
                    <div>
                      <span className="text-muted-foreground text-[11px] block font-sans">সর্বমোট ডিম:</span>
                      <strong className="text-sm font-bold text-foreground">
                        {item.grand_total_eggs.toLocaleString()} টি
                      </strong>
                      <span className="text-[11px] text-muted-foreground block">
                        ({item.full_trays} ট্রে, {item.remainder_eggs} ডিম)
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[11px] block font-sans">খাঁচা হিসাব:</span>
                      <span className="text-foreground">
                        {(item.stacks || [])
                          .map((s) => `${s.traysPerStack || 0}×${s.stacksCount || 0}`)
                          .join(" + ")}
                      </span>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 block font-bold">
                        = {item.total_trays} ট্রে ({item.total_tray_eggs.toLocaleString()} টি)
                      </span>
                    </div>

                    <div>
                      {item.system_stock !== null && item.system_stock !== undefined ? (
                        <div>
                          <span className="text-muted-foreground text-[11px] block font-sans">স্টক তুলনা:</span>
                          <span className="text-muted-foreground">
                            সিস্টেম: {item.system_stock.toLocaleString()} টি
                          </span>
                          <div className="mt-0.5">
                            {item.stock_difference === 0 ? (
                              <span className="font-bold text-emerald-600 text-xs">✓ হুবহু মিলেছে</span>
                            ) : (item.stock_difference || 0) < 0 ? (
                              <span className="font-bold text-destructive text-xs">
                                {item.stock_difference?.toLocaleString()} টি ঘাটতি
                              </span>
                            ) : (
                              <span className="font-bold text-blue-600 text-xs">
                                +{item.stock_difference?.toLocaleString()} টি অতিরিক্ত
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-muted-foreground text-[11px] block font-sans">খোলা ডিম:</span>
                          <span className="text-foreground">
                            মোট {item.total_loose_eggs.toLocaleString()} টি
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
