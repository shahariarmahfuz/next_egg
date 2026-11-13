"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  RotateCcw,
  Copy,
  CalendarDays,
  History,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalculatorHistoryEntry,
  readCalculatorHistory,
  writeCalculatorHistory,
  clearCalculatorHistory,
  loadHistoryEntryIntoCalculatorState,
  formatStockVerificationText,
} from "./egg-calculator-storage";

export function EggCalculatorHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<CalculatorHistoryEntry[]>([]);
  const [historyProductFilter, setHistoryProductFilter] = useState<string>("all");

  useEffect(() => {
    setHistory(readCalculatorHistory());
  }, []);

  const handleLoadFromHistory = (entry: CalculatorHistoryEntry) => {
    loadHistoryEntryIntoCalculatorState(entry);
    toast.success("হিসাবটি ক্যালকুলেটরে লোড করা হয়েছে!");
    router.push("/calculators/egg");
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    writeCalculatorHistory(updated);
    toast.success("হিস্ট্রি আইটেম মুছে ফেলা হয়েছে।");
  };

  const handleClearAllHistory = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("আপনি কি নিশ্চিত যে সকল সংরক্ষিত হিস্ট্রি মুছে ফেলতে চান?")
    ) {
      setHistory([]);
      clearCalculatorHistory();
      toast.success("সকল হিস্ট্রি মুছে ফেলা হয়েছে।");
    }
  };

  const handleCopyHistoryItem = async (entry: CalculatorHistoryEntry) => {
    try {
      const stacksBreakdown = entry.stacks
        .map(
          (r) =>
            `${r.traysPerStack || 0} × ${r.stacksCount || 0} = ${(Number(r.traysPerStack) || 0) * (Number(r.stacksCount) || 0)}`
        )
        .join("\n");

      const stockVerificationText = formatStockVerificationText(
        entry.productName,
        entry.systemStock,
        entry.grandTotalEggs,
        entry.stockDifference
      );

      const text = `🥚 ডিমের হিসাব বিবরণী (${entry.formattedDate})
------------------------------
${stacksBreakdown}
------------------------------
মোট ট্রে: ${entry.totalTrays.toLocaleString()} ট্রে
ট্রে ডিম: ${entry.totalTrayEggs.toLocaleString()} টি
খোলা ডিম: ${entry.totalLooseEggs.toLocaleString()} টি
------------------------------
সর্বমোট ডিম: ${entry.grandTotalEggs.toLocaleString()} টি
ট্রে হিসেবে: ${entry.grandTotalConversion.fullTrays} ট্রে, ${entry.grandTotalConversion.remainderEggs} ডিম${stockVerificationText}
------------------------------
Akota Poultry`;

      await navigator.clipboard.writeText(text);
      toast.success("হিসাব ক্লিপবোর্ডে কপি করা হয়েছে!");
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const filteredHistory = useMemo(() => {
    if (historyProductFilter === "all") return history;
    return history.filter((h) => h.productName === historyProductFilter);
  }, [history, historyProductFilter]);

  const historyProductOptions = useMemo(() => {
    const names = new Set<string>();
    history.forEach((h) => {
      if (h.productName) names.add(h.productName);
    });
    return Array.from(names);
  }, [history]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <Card className="rounded-xl border-border/70 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span>ক্যালকুলেটর হিস্ট্রি লগ (Calculation History)</span>
              {history.length > 0 && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-mono">
                  {history.length}
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              তারিখ ও পণ্য অনুযায়ী পূর্বে সংরক্ষিত হিসাবসমূহ
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            {history.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAllHistory}
                className="h-8 text-xs text-muted-foreground hover:text-destructive border-border/70 rounded-lg gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>সব মুছুন</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-4 space-y-3">
          {/* Optional Filter by Product */}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border/50">
              <span className="text-xs font-medium text-muted-foreground">পণ্য ফিল্টার:</span>
              <select
                value={historyProductFilter}
                onChange={(e) => setHistoryProductFilter(e.target.value)}
                className="h-8 text-xs font-medium bg-background border border-border/80 rounded-lg px-2 text-foreground"
              >
                <option value="all">সকল পণ্য ({history.length})</option>
                {historyProductOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* History Items List */}
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h4 className="text-sm font-semibold text-foreground">কোনো সংরক্ষিত হিস্ট্রি নেই</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                ক্যালকুলেটরে হিসাব করার পর &quot;হিস্ট্রিতে সংরক্ষণ করুন&quot; বাটনে ক্লিক করলে তা এখানে তারিখ অনুযায়ী সংরক্ষিত থাকবে।
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/calculators/egg")}
                className="mt-2 h-8 text-xs font-semibold rounded-lg"
              >
                ক্যালকুলেটরে যান
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 rounded-xl border border-border/70 bg-muted/10 hover:bg-muted/20 transition-colors space-y-2.5"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{item.formattedDate}</span>
                      </span>
                      {item.productName ? (
                        <Badge
                          variant="secondary"
                          className="font-semibold text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          {item.productName}
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
                        onClick={() => handleDeleteHistoryItem(item.id)}
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
                        {item.grandTotalEggs.toLocaleString()} টি
                      </strong>
                      <span className="text-[11px] text-muted-foreground block">
                        ({item.grandTotalConversion.fullTrays} ট্রে, {item.grandTotalConversion.remainderEggs} ডিম)
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[11px] block font-sans">খাঁচা হিসাব:</span>
                      <span className="text-foreground">
                        {item.stacks.map((s) => `${s.traysPerStack || 0}×${s.stacksCount || 0}`).join(" + ")}
                      </span>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 block font-bold">
                        = {item.totalTrays} ট্রে ({item.totalTrayEggs.toLocaleString()} টি)
                      </span>
                    </div>

                    <div>
                      {item.systemStock !== null && item.systemStock !== undefined ? (
                        <div>
                          <span className="text-muted-foreground text-[11px] block font-sans">স্টক তুলনা:</span>
                          <span className="text-muted-foreground">সিস্টেম: {item.systemStock.toLocaleString()} টি</span>
                          <div className="mt-0.5">
                            {item.stockDifference === 0 ? (
                              <span className="font-bold text-emerald-600 text-xs">✓ হুবহু মিলেছে</span>
                            ) : (item.stockDifference || 0) < 0 ? (
                              <span className="font-bold text-destructive text-xs">
                                {item.stockDifference?.toLocaleString()} টি ঘাটতি
                              </span>
                            ) : (
                              <span className="font-bold text-blue-600 text-xs">
                                +{item.stockDifference?.toLocaleString()} টি অতিরিক্ত
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-muted-foreground text-[11px] block font-sans">খোলা ডিম:</span>
                          <span className="text-foreground">
                            মোট {item.totalLooseEggs.toLocaleString()} টি
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
