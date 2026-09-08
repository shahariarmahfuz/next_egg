'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  Layers,
  PlusCircle,
  Truck,
  RefreshCw,
  X,
  Building2,
  BarChart3,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { farmService } from "@/services/api";
import { FarmBalanceItem, FarmLedgerResponse } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function FarmLedgerPage() {
  const { hasPermission } = useAuth();
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [ledger, setLedger] = useState<FarmLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Fetch all farms for the dropdown
  useEffect(() => {
    const loadFarms = async () => {
      setLoadingFarms(true);
      try {
        const res = await farmService.getFarms();
        if (res.success && res.data) {
          setFarms(res.data);
          if (res.data.length > 0 && !selectedFarmId) {
            setSelectedFarmId(res.data[0].id);
          }
        }
      } catch (err: any) {
        console.error("Failed to load farms:", err);
        toast.error("Failed to load farms");
      } finally {
        setLoadingFarms(false);
      }
    };
    loadFarms();
  }, []);

  // Fetch ledger data when farm or dates change
  const fetchLedger = async (farmId: string, start?: string, end?: string) => {
    if (!farmId) return;

    setLoadingLedger(true);
    try {
      const res = await farmService.getFarmLedger(farmId, {
        start_date: start || undefined,
        end_date: end || undefined,
      });

      if (res.success && res.data) {
        setLedger(res.data);
      } else {
        setLedger(null);
      }
    } catch (err: any) {
      console.error("Failed to load farm ledger:", err);
      toast.error("Failed to load farm ledger");
      setLedger(null);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (selectedFarmId) {
      fetchLedger(selectedFarmId, startDate, endDate);
    }
  }, [selectedFarmId, startDate, endDate]);

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <HasPermission
      code={["farm.report", "farm.view"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Farm Ledger.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-purple-500/10 text-purple-600 rounded-lg sm:rounded-xl shrink-0">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Farm Ledger</h1>
              <p className="text-[11px] sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Complete chronological tray movement history and running balance for the selected farm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            {hasPermission(["farm.view", "farm.edit", "farm.delete"]) && (
              <Link href="/farm">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  <Layers className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  <span className="hidden xs:inline sm:inline">Manage </span>Farm
                </Button>
              </Link>
            )}
            {hasPermission(["farm.production.view", "farm.production.create"]) && (
              <Link href="/farm/production">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  <PlusCircle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                  Production
                </Button>
              </Link>
            )}
            {hasPermission(["farm.delivery.view", "farm.delivery.create"]) && (
              <Link href="/farm/delivery">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  <Truck className="h-3.5 w-3.5 mr-1 text-blue-500" />
                  Delivery
                </Button>
              </Link>
            )}
            {hasPermission("farm.report") && (
              <Link href="/farm/report">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  <BarChart3 className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                  Report
                </Button>
              </Link>
            )}
          </div>
        </div>

      {/* Top Filter Bar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-4">
              {/* Farm Selection */}
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                  Farm: <span className="text-destructive">*</span>
                </span>
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  disabled={loadingFarms || farms.length === 0}
                  className="flex h-8 sm:h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring flex-1 sm:min-w-[220px]"
                >
                  {loadingFarms ? (
                    <option value="">Loading farms...</option>
                  ) : farms.length === 0 ? (
                    <option value="">No farms available</option>
                  ) : (
                    farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Balance: {f.available_tray} trays)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date Filters & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
                  <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3" /> From:
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs h-8 sm:h-9 w-full sm:w-36"
                  />
                </div>

                <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
                  <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground shrink-0">To:</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs h-8 sm:h-9 w-full sm:w-36"
                  />
                </div>

                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilter}
                    className="text-xs h-8 sm:h-9 text-muted-foreground hover:text-foreground px-2"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchLedger(selectedFarmId, startDate, endDate)}
                  disabled={loadingLedger || !selectedFarmId}
                  className="text-xs h-8 sm:h-9 px-2 sm:px-3"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingLedger ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Current Summary Indicators */}
            {ledger && (
              <div className="grid grid-cols-2 sm:flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                <div className="px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-[11px] sm:text-xs text-center sm:text-left">
                  <span className="text-muted-foreground block xs:inline sm:inline mr-1">Opening:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {Number(ledger.opening_balance).toLocaleString()}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 text-center sm:text-left">
                  <span className="block xs:inline sm:inline mr-1">Balance:</span>
                  <span className="font-bold font-mono">
                    {Number(ledger.closing_balance).toLocaleString()} <span className="text-[10px] sm:text-xs font-normal">Trays</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                {ledger ? `${ledger.farm_name} — Tray Ledger` : "Farm Tray Ledger"}
              </CardTitle>
              <CardDescription className="hidden sm:block text-xs text-muted-foreground">
                Formula: Opening Tray + Production - Delivery = Running Balance
              </CardDescription>
            </div>
            {ledger && (
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
                <span className="text-amber-600 font-semibold">
                  +Prod: {Number(ledger.total_production).toLocaleString()}
                </span>
                <span className="text-blue-600 font-semibold">
                  -Deliv: {Number(ledger.total_delivery).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold text-[11px] sm:text-xs">
                <tr>
                  <th className="px-2.5 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Date</th>
                  <th className="px-2.5 py-2 sm:px-4 sm:py-3">Description</th>
                  <th className="px-2.5 py-2 sm:px-4 sm:py-3 text-right font-bold text-amber-600 whitespace-nowrap">
                    <span className="sm:hidden">Prod</span>
                    <span className="hidden sm:inline">Production</span>
                  </th>
                  <th className="px-2.5 py-2 sm:px-4 sm:py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                    <span className="sm:hidden">Deliv</span>
                    <span className="hidden sm:inline">Delivery</span>
                  </th>
                  <th className="px-2.5 py-2 sm:px-4 sm:py-3 text-right font-bold text-foreground whitespace-nowrap">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingLedger ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !ledger || ledger.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 sm:px-4 sm:py-12 text-center text-muted-foreground">
                      <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium text-xs sm:text-sm">No transactions found</p>
                      <p className="text-[11px] sm:text-xs mt-1">Select a farm above or adjust date filters.</p>
                    </td>
                  </tr>
                ) : (
                  ledger.items.map((item, idx) => {
                    const isOpening = item.type === "opening";
                    const isProduction = item.type === "production";
                    const isDelivery = item.type === "delivery";

                    return (
                      <tr
                        key={item.id || `ledger-${idx}`}
                        className={`transition-colors h-10 sm:h-11 ${
                          isOpening
                            ? "bg-muted/40 font-medium text-muted-foreground"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Date */}
                        <td className="px-2.5 py-1.5 sm:px-4 sm:py-3 font-mono font-medium text-[11px] sm:text-xs text-foreground whitespace-nowrap">
                          {isOpening ? (
                            <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold py-0.5 px-1.5">
                              Opening
                            </Badge>
                          ) : (
                            item.date
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-2.5 py-1.5 sm:px-4 sm:py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`truncate max-w-[100px] sm:max-w-[200px] md:max-w-none text-xs sm:text-sm ${
                                isOpening
                                  ? "font-semibold text-muted-foreground"
                                  : isProduction
                                  ? "font-medium text-foreground"
                                  : "font-medium text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {item.description}
                            </span>
                            {item.notes && (
                              <span className="hidden sm:inline text-[11px] text-muted-foreground italic truncate">
                                ({item.notes})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Production */}
                        <td className="px-2.5 py-1.5 sm:px-4 sm:py-3 text-right font-mono text-xs sm:text-sm whitespace-nowrap">
                          {item.production != null ? (
                            <span className="text-amber-600 font-bold">
                              +{Number(item.production).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Delivery */}
                        <td className="px-2.5 py-1.5 sm:px-4 sm:py-3 text-right font-mono text-xs sm:text-sm whitespace-nowrap">
                          {item.delivery != null ? (
                            <span className="text-blue-600 font-bold">
                              {Number(item.delivery).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Running Balance */}
                        <td className="px-2.5 py-1.5 sm:px-4 sm:py-3 text-right font-mono font-bold text-xs sm:text-sm text-foreground whitespace-nowrap">
                          {Number(item.balance).toLocaleString()} <span className="hidden sm:inline text-xs font-normal">Trays</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {ledger && (
                <tfoot className="bg-muted/50 font-bold border-t-2 border-border text-xs sm:text-sm">
                  <tr>
                    <td colSpan={2} className="px-2.5 py-2 sm:px-4 sm:py-3 text-foreground font-semibold">
                      Current Balance
                    </td>
                    <td className="px-2.5 py-2 sm:px-4 sm:py-3 text-right text-amber-600 font-mono whitespace-nowrap">
                      {ledger.total_production > 0 ? `+${Number(ledger.total_production).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-2.5 py-2 sm:px-4 sm:py-3 text-right text-blue-600 font-mono whitespace-nowrap">
                      {ledger.total_delivery > 0 ? `${Number(ledger.total_delivery).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-2.5 py-2 sm:px-4 sm:py-3 text-right text-emerald-700 dark:text-emerald-400 font-mono text-xs sm:text-sm whitespace-nowrap">
                      {Number(ledger.closing_balance).toLocaleString()} Trays
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </HasPermission>
  );
}
