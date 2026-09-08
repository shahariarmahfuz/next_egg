'use client';

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart3,
  Calendar,
  Layers,
  PlusCircle,
  Truck,
  BookOpen,
  RefreshCw,
  Sprout,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { farmService } from "@/services/api";
import { FarmBalanceItem, FarmProductionItem, FarmDeliveryItem } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

function getLocalToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[/-]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed;
}

export default function ProductionDeliveryReportPage() {
  const { hasPermission } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getLocalToday);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [productions, setProductions] = useState<FarmProductionItem[]>([]);
  const [deliveries, setDeliveries] = useState<FarmDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load farms for filter dropdown
  useEffect(() => {
    farmService.getFarms().then((res) => {
      if (res.success && res.data) {
        setFarms(res.data);
      }
    }).catch(console.error);
  }, []);

  const fetchReportData = async (rawDate: string, farmId: string) => {
    const date = normalizeDate(rawDate);
    if (!date) return;
    setLoading(true);
    try {
      const cleanFarmId = farmId && farmId !== "all" ? farmId.trim() : undefined;
      const [prodRes, delivRes] = await Promise.all([
        farmService.getProductions({
          start_date: date,
          end_date: date,
          farm_id: cleanFarmId,
          size: 500,
        }),
        farmService.getDeliveries({
          start_date: date,
          end_date: date,
          farm_id: cleanFarmId,
          size: 500,
        }),
      ]);

      if (prodRes?.success && prodRes?.data?.items) {
        setProductions(prodRes.data.items);
      } else {
        setProductions([]);
      }

      if (delivRes?.success && delivRes?.data?.items) {
        setDeliveries(delivRes.data.items);
      } else {
        setDeliveries([]);
      }
    } catch (err: any) {
      console.error("Failed to load report data:", err);
      const errorMsg = err?.message || "Failed to load report data";
      toast.error(errorMsg);
      setProductions([]);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(selectedDate, selectedFarmId);
  }, [selectedDate, selectedFarmId]);

  const totalProduction = productions.reduce(
    (sum, p) => sum + Number(p.tray_quantity || 0),
    0
  );

  const totalDelivery = deliveries.reduce(
    (sum, d) => sum + Number(d.tray_quantity || 0),
    0
  );

  return (
    <HasPermission
      code="farm.report"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Farm Reports.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-indigo-500/10 text-indigo-600 rounded-lg sm:rounded-xl shrink-0">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                Production & Delivery Report
              </h1>
              <p className="text-[11px] sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Daily summary of egg tray production harvests and delivery dispatches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            {hasPermission(["farm.view", "farm.create", "farm.edit", "farm.delete"]) && (
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
            {hasPermission(["farm.report", "farm.view"]) && (
              <Link href="/farm/ledger">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  <BookOpen className="h-3.5 w-3.5 mr-1 text-purple-600" />
                  Ledger
                </Button>
              </Link>
            )}
          </div>
        </div>

      {/* Filter Controls Bar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-4">
              {/* Date Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Date:
                </span>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs h-8 sm:h-9 flex-1 sm:w-40"
                />
              </div>

              {/* Farm Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-foreground shrink-0">Farm:</span>
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  className="flex h-8 sm:h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring flex-1 sm:min-w-[180px]"
                >
                  <option value="">All Farms</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchReportData(selectedDate, selectedFarmId)}
                  disabled={loading}
                  className="text-xs h-8 px-2 shrink-0 sm:hidden"
                  title="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchReportData(selectedDate, selectedFarmId)}
                disabled={loading}
                className="hidden sm:inline-flex text-xs h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Quick Summary Badges */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
              <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border border-amber-500/20 text-center sm:text-left">
                <span className="text-muted-foreground block xs:inline sm:inline">Prod: </span>
                <span className="font-bold font-mono">{totalProduction.toLocaleString()}</span> Trays
              </div>
              <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border border-blue-500/20 text-center sm:text-left">
                <span className="text-muted-foreground block xs:inline sm:inline">Deliv: </span>
                <span className="font-bold font-mono">{totalDelivery.toLocaleString()}</span> Trays
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tables Grid: Production & Delivery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* PRODUCTION TABLE */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5 sm:gap-2">
                <PlusCircle className="h-4 w-4" />
                PRODUCTION
              </CardTitle>
              <Badge variant="outline" className="text-[11px] sm:text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 px-2 py-0.5">
                {totalProduction.toLocaleString()} Trays
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold text-[11px] sm:text-xs">
                  <tr>
                    <th className="px-3 py-2 sm:px-4 sm:py-3">Farm</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-right font-bold">Tray</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={2} className="p-3">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : productions.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 sm:px-4 sm:py-8 text-center text-muted-foreground text-xs">
                        No production records on {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    productions.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors h-10 sm:h-11">
                        <td className="px-3 py-2 sm:px-4 sm:py-3 font-medium text-xs sm:text-sm text-foreground truncate max-w-[160px] sm:max-w-none">
                          {p.farm_name || "Unknown Farm"}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-bold text-amber-600 font-mono text-xs sm:text-sm whitespace-nowrap">
                          {Number(p.tray_quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {productions.length > 0 && (
                  <tfoot className="bg-muted/40 font-bold border-t border-border text-xs sm:text-sm">
                    <tr>
                      <td className="px-3 py-2 sm:px-4 sm:py-3 text-foreground">Total Production</td>
                      <td className="px-3 py-2 sm:px-4 sm:py-3 text-right text-amber-600 font-mono">
                        {totalProduction.toLocaleString()} Trays
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        {/* DELIVERY TABLE */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 sm:gap-2">
                <Truck className="h-4 w-4" />
                DELIVERY
              </CardTitle>
              <Badge variant="outline" className="text-[11px] sm:text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 px-2 py-0.5">
                {totalDelivery.toLocaleString()} Trays
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold text-[11px] sm:text-xs">
                  <tr>
                    <th className="px-3 py-2 sm:px-4 sm:py-3">Farm</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-right font-bold">Tray</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3">Store / Dest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={3} className="p-3">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 sm:px-4 sm:py-8 text-center text-muted-foreground text-xs">
                        No delivery records on {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors h-10 sm:h-11">
                        <td className="px-3 py-2 sm:px-4 sm:py-3 font-medium text-xs sm:text-sm text-foreground truncate max-w-[100px] sm:max-w-none">
                          {d.farm_name || "Unknown Farm"}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-bold text-blue-600 font-mono text-xs sm:text-sm whitespace-nowrap">
                          {Number(d.tray_quantity).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 text-foreground">
                          <Badge variant="secondary" className="font-normal text-[10px] sm:text-xs truncate max-w-[90px] sm:max-w-none block sm:inline-block">
                            {d.destination}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {deliveries.length > 0 && (
                  <tfoot className="bg-muted/40 font-bold border-t border-border text-xs sm:text-sm">
                    <tr>
                      <td className="px-3 py-2 sm:px-4 sm:py-3 text-foreground">Total Delivery</td>
                      <td className="px-3 py-2 sm:px-4 sm:py-3 text-right text-blue-600 font-mono">
                        {totalDelivery.toLocaleString()} Trays
                      </td>
                      <td className="px-3 py-2 sm:px-4 sm:py-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </HasPermission>
  );
}
