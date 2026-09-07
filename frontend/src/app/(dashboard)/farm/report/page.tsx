'use client';

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Sprout,
  Layers,
  Truck,
  RotateCcw,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { farmService } from "@/services/api";
import { FarmBalanceItem, FarmReportResponse } from "@/types";
import { toast } from "sonner";

export default function FarmReportPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [reportData, setReportData] = useState<FarmReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFarms() {
      try {
        const res = await farmService.getFarms();
        if (res.success && res.data) {
          setFarms(res.data);
        }
      } catch (err) {
        console.error("Failed to load farms:", err);
      }
    }
    loadFarms();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await farmService.getFarmReport({
        farm_id: selectedFarmId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        toast.error(res.message || "Failed to load farm report");
      }
    } catch (err: any) {
      console.error("Farm report fetch error:", err);
      toast.error("Failed to load farm report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedFarmId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }
    if (days === 1) {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split("T")[0];
      setStartDate(yestStr);
      setEndDate(yestStr);
      return;
    }
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const setMonthPreset = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(todayStr);
  };

  const handleExportCSV = () => {
    if (!reportData?.items || reportData.items.length === 0) {
      toast.info("No report data available to export");
      return;
    }

    const headers = [
      "Date",
      "Farm Name",
      "Farm Code",
      "Production (Trays)",
      "Total Delivered (Trays)",
      "Delivery Breakdown",
      "Net Trays",
    ];

    const csvRows = [
      headers.join(","),
      ...reportData.items.map((row) => {
        const breakdownStr = row.deliveries
          .map((d) => `${d.destination}: ${d.trays} trays`)
          .join("; ");
        const net = row.production_trays - row.delivery_trays;
        return [
          row.date,
          `"${(row.farm_name || "N/A").replace(/"/g, '""')}"`,
          `"${(row.farm_code || "").replace(/"/g, '""')}"`,
          row.production_trays,
          row.delivery_trays,
          `"${breakdownStr.replace(/"/g, '""')}"`,
          net,
        ].join(",");
      }),
      "",
      `"TOTALS",,"${reportData.kpis.total_production} trays","${reportData.kpis.total_delivered} trays",,"${
        reportData.kpis.total_production - reportData.kpis.total_delivered
      } trays"`,
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `farm_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Farm report exported to CSV");
  };

  const kpis = reportData?.kpis;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Farm Report</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Date-wise production and delivery breakdown by destination (Calculated from complete dataset)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !reportData?.items || reportData.items.length === 0}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Link href="/farm">
            <Button variant="outline" size="sm" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Farm Management
            </Button>
          </Link>
          <Link href="/farm/add">
            <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Farm
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border/60">
            <span className="text-xs font-semibold text-muted-foreground">Quick Presets:</span>
            <Button
              variant={startDate === todayStr && endDate === todayStr ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPreset(0)}
              className="h-7 text-xs px-2.5"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreset(1)}
              className="h-7 text-xs px-2.5"
            >
              Yesterday
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreset(7)}
              className="h-7 text-xs px-2.5"
            >
              Last 7 Days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreset(30)}
              className="h-7 text-xs px-2.5"
            >
              Last 30 Days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={setMonthPreset}
              className="h-7 text-xs px-2.5"
            >
              This Month
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {/* Farm Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Sprout className="h-3.5 w-3.5 text-emerald-600" /> Farm Location
              </label>
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Farms</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> From Date (Inclusive)
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> To Date (Inclusive)
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                  setSelectedFarmId("");
                }}
                className="h-9 text-xs flex-1"
              >
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchReport()}
                disabled={loading}
                className="h-9 px-3 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Previous Tray */}
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Previous Tray
              </span>
              <RotateCcw className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground mt-1 font-mono">
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `${(kpis?.total_previous_trays || 0).toLocaleString()} trays`
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Opening starting balance</p>
          </CardContent>
        </Card>

        {/* Total Production */}
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Period Production
              </span>
              <Layers className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `+${(kpis?.total_production || 0).toLocaleString()} trays`
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Harvested in period</p>
          </CardContent>
        </Card>

        {/* Total Delivered */}
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Period Delivered
              </span>
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `-${(kpis?.total_delivered || 0).toLocaleString()} trays`
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dispatched across all destinations</p>
          </CardContent>
        </Card>

        {/* Total Available */}
        <Card className="border border-primary/20 shadow-sm bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Available Tray
              </span>
              <Sprout className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-extrabold text-primary mt-1 font-mono">
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `${(kpis?.total_available_trays || 0).toLocaleString()} trays`
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Current net on-hand trays</p>
          </CardContent>
        </Card>
      </div>

      {/* Date-wise Detailed Breakdown Table */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Date-wise Production & Delivery Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Daily summary with destination-wise dispatches ({reportData?.items?.length || 0} dates)
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {startDate === endDate
              ? format(new Date(startDate), "dd MMM yyyy")
              : `${format(new Date(startDate), "dd MMM")} – ${format(new Date(endDate), "dd MMM yyyy")}`}
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">SL</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Farm</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Production</th>
                  <th className="px-4 py-3">Delivery Breakdown by Destination</th>
                  <th className="px-4 py-3 text-right text-blue-600 font-bold">Total Delivered</th>
                  <th className="px-4 py-3 text-right font-bold">Net Trays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-3">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !reportData?.items || reportData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium">No production or delivery records found for this period.</p>
                      <p className="text-[11px] mt-1">
                        Try expanding the date range or selecting All Farms.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {reportData.items.map((item, idx) => {
                      const netDay = item.production_trays - item.delivery_trays;
                      return (
                        <tr key={`${item.date}-${item.farm_id}`} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {format(new Date(item.date), "dd MMM yyyy")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{item.farm_name}</span>
                              {item.farm_code && (
                                <Badge variant="outline" className="font-mono text-[9px] px-1 py-0">
                                  {item.farm_code}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono text-sm">
                            {item.production_trays > 0 ? `+${item.production_trays.toLocaleString()} trays` : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {item.deliveries.length === 0 ? (
                              <span className="text-muted-foreground/50 italic">No deliveries</span>
                            ) : (
                              <div className="space-y-1">
                                {item.deliveries.map((deliv, dIdx) => (
                                  <div key={dIdx} className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                                      <MapPin className="h-3 w-3" />
                                      {deliv.destination}
                                    </span>
                                    <span className="text-muted-foreground">—</span>
                                    <span className="font-bold text-blue-600 font-mono">
                                      {deliv.trays} trays
                                    </span>
                                    {deliv.notes && (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        ({deliv.notes})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600 font-mono text-sm">
                            {item.delivery_trays > 0 ? `-${item.delivery_trays.toLocaleString()} trays` : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold font-mono text-sm">
                            <span
                              className={
                                netDay > 0
                                   ? "text-emerald-600"
                                   : netDay < 0
                                   ? "text-rose-600"
                                   : "text-muted-foreground"
                              }
                            >
                              {netDay > 0 ? `+${netDay}` : netDay}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals Summary Row */}
                    <tr className="bg-muted/70 font-semibold border-t-2 border-border text-foreground">
                      <td colSpan={3} className="px-4 py-3 font-bold text-right uppercase tracking-wider text-xs">
                        Filtered Period Totals
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-600 font-mono text-sm">
                        +{(kpis?.total_production || 0).toLocaleString()} trays
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">
                        Aggregated over complete filtered dataset
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-blue-600 font-mono text-sm">
                        -{(kpis?.total_delivered || 0).toLocaleString()} trays
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-foreground font-mono text-sm">
                        {((kpis?.total_production || 0) - (kpis?.total_delivered || 0) > 0 ? "+" : "") +
                          ((kpis?.total_production || 0) - (kpis?.total_delivered || 0)).toLocaleString()}{" "}
                        trays
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
