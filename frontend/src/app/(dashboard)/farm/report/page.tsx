"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  Search,
  ArrowLeft,
  Download,
  Layers,
  Truck,
  AlertCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { farmService } from "@/services/api";
import { FarmReportRow, FarmReportResponse } from "@/types";
import { toast } from "sonner";

export default function FarmReportPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reportData, setReportData] = useState<FarmReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await farmService.getFarmReport({
        start_date: startDate,
        end_date: endDate,
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
  }, [startDate, endDate]);

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

  const handleExportCSV = () => {
    if (!reportData?.items || reportData.items.length === 0) {
      toast.info("No report data available to export");
      return;
    }

    const headers = ["Date", "Product", "Production", "Delivery", "Waste", "Remaining Farm Stock"];
    const csvRows = [
      headers.join(","),
      ...reportData.items.map((row) =>
        [
          row.date,
          `"${(row.product_name || "").replace(/"/g, '""')}"`,
          row.production,
          row.delivery,
          row.waste,
          row.remaining_quantity,
        ].join(",")
      ),
      "",
      `"TOTALS",,${reportData.total_production},${reportData.total_delivery},${reportData.total_waste},${reportData.total_remaining}`,
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `farm-report-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Farm report exported to CSV");
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <Link href="/farm">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Farm Tracking Report</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Quantity-based audit trail of production, deliveries, waste, and remaining stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !reportData?.items?.length}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3 flex-1">
              <div className="space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-muted-foreground">From Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-44 text-xs"
                />
              </div>

              <div className="space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-muted-foreground">To Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-44 text-xs"
                />
              </div>

              <Button onClick={fetchReport} disabled={loading} size="sm" className="text-xs">
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Filter Report
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground mr-1">Quick:</span>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5"
                onClick={() => setPreset(0)}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5"
                onClick={() => setPreset(1)}
              >
                Yesterday
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5"
                onClick={() => setPreset(7)}
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5"
                onClick={() => setPreset(30)}
              >
                Last 30 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Production */}
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-xl shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 truncate">
                Period Production
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {reportData?.total_production ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Units Produced</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Delivery */}
        <Card className="glass-card border-blue-500/30 bg-blue-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-blue-500/20 text-blue-600 rounded-xl shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 truncate">
                Period Delivery
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {reportData?.total_delivery ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Units Dispatched</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Waste */}
        <Card className="glass-card border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-rose-500/20 text-rose-600 rounded-xl shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 truncate">
                Period Waste / Loss
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {reportData?.total_waste ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Units Damaged / Lost</p>
            </div>
          </CardContent>
        </Card>

        {/* Current Remaining */}
        <Card className="glass-card border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-primary/20 text-primary rounded-xl shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
                Remaining Farm Stock
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {reportData?.total_remaining ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Current Net Balance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Production (+)</th>
                  <th className="px-4 py-3 text-right text-blue-600">Delivery (-)</th>
                  <th className="px-4 py-3 text-right text-rose-600">Waste (-)</th>
                  <th className="px-4 py-3 text-right font-bold text-foreground">Remaining Farm Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !reportData?.items || reportData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      No farm records found for the selected date range ({startDate} to {endDate}).
                    </td>
                  </tr>
                ) : (
                  reportData.items.map((row: FarmReportRow, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.date ? format(new Date(row.date), "dd MMM yyyy") : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center space-x-2">
                          <span>{row.product_name}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-600 bg-amber-500/10">
                            FARM
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {row.production > 0 ? `+${row.production}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        {row.delivery > 0 ? `-${row.delivery}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        {row.waste > 0 ? `-${row.waste}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-foreground text-sm">
                        <span className={row.remaining_quantity > 0 ? "text-emerald-600" : "text-destructive"}>
                          {row.remaining_quantity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportData?.items && reportData.items.length > 0 && (
                <tfoot className="bg-muted/60 border-t border-border font-bold text-foreground">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs uppercase tracking-wider">
                      Period Totals
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-extrabold">
                      +{reportData.total_production}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-extrabold">
                      -{reportData.total_delivery}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-extrabold">
                      -{reportData.total_waste}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-black text-sm">
                      {reportData.total_remaining}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
