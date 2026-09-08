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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Farm Ledger</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Complete chronological tray movement history and running balance for the selected farm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(["farm.view", "farm.edit", "farm.delete"]) && (
              <Link href="/farm">
                <Button variant="outline" size="sm" className="text-xs">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Manage Farm
                </Button>
              </Link>
            )}
            {hasPermission(["farm.production.view", "farm.production.create"]) && (
              <Link href="/farm/production">
                <Button variant="outline" size="sm" className="text-xs">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  Production
                </Button>
              </Link>
            )}
            {hasPermission(["farm.delivery.view", "farm.delivery.create"]) && (
              <Link href="/farm/delivery">
                <Button variant="outline" size="sm" className="text-xs">
                  <Truck className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                  Delivery
                </Button>
              </Link>
            )}
            {hasPermission("farm.report") && (
              <Link href="/farm/report">
                <Button variant="outline" size="sm" className="text-xs">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                  Report
                </Button>
              </Link>
            )}
          </div>
        </div>

      {/* Top Filter Bar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Farm Selection */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                  Farm: <span className="text-destructive">*</span>
                </span>
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  disabled={loadingFarms || farms.length === 0}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring min-w-[220px]"
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

              {/* Date Filter (Start Date) */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> From:
                </span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs h-9 w-36"
                />
              </div>

              {/* Date Filter (End Date) */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs h-9 w-36"
                />
              </div>

              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilter}
                  className="text-xs h-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear Dates
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchLedger(selectedFarmId, startDate, endDate)}
                disabled={loadingLedger || !selectedFarmId}
                className="text-xs h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingLedger ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Current Summary Indicators */}
            {ledger && (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs">
                  <span className="text-muted-foreground mr-1">Opening:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {Number(ledger.opening_balance).toLocaleString()}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="mr-1">Current Balance:</span>
                  <span className="font-bold font-mono">
                    {Number(ledger.closing_balance).toLocaleString()} Trays
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                {ledger ? `${ledger.farm_name} — Tray Ledger` : "Farm Tray Ledger"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Formula: Opening Tray + Production - Delivery = Running Balance
              </CardDescription>
            </div>
            {ledger && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-amber-600 font-semibold">
                  +Production: {Number(ledger.total_production).toLocaleString()}
                </span>
                <span className="text-blue-600 font-semibold">
                  -Delivery: {Number(ledger.total_delivery).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 w-32">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-600 w-36">Production</th>
                  <th className="px-4 py-3 text-right font-bold text-blue-600 w-36">Delivery</th>
                  <th className="px-4 py-3 text-right font-bold text-foreground w-40">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingLedger ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-3">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !ledger || ledger.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium text-sm">No transactions found</p>
                      <p className="text-xs mt-1">Select a farm above or adjust date filters.</p>
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
                        className={`transition-colors ${
                          isOpening
                            ? "bg-muted/40 font-medium text-muted-foreground"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          {isOpening ? (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5">
                              Opening
                            </Badge>
                          ) : (
                            item.date
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3">
                          <span
                            className={
                              isOpening
                                ? "font-semibold text-muted-foreground"
                                : isProduction
                                ? "font-medium text-foreground"
                                : "font-medium text-blue-700 dark:text-blue-300"
                            }
                          >
                            {item.description}
                          </span>
                          {item.notes && (
                            <span className="ml-2 text-[11px] text-muted-foreground italic">
                              ({item.notes})
                            </span>
                          )}
                        </td>

                        {/* Production */}
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {item.production != null ? (
                            <span className="text-amber-600 font-bold">
                              +{Number(item.production).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Delivery */}
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {item.delivery != null ? (
                            <span className="text-blue-600 font-bold">
                              {Number(item.delivery).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Running Balance */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          {Number(item.balance).toLocaleString()} Trays
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {ledger && (
                <tfoot className="bg-muted/50 font-bold border-t-2 border-border">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-foreground font-semibold">
                      Current Balance
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-mono">
                      {ledger.total_production > 0 ? `+${Number(ledger.total_production).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-mono">
                      {ledger.total_delivery > 0 ? `${Number(ledger.total_delivery).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-mono text-sm">
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
