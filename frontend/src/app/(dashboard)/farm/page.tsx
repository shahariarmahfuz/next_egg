"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  PlusCircle,
  Truck,
  AlertCircle,
  Layers,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { farmService } from "@/services/api";
import { FarmDashboardKPIs, FarmStockItem } from "@/types";

export default function FarmDashboardPage() {
  const [kpis, setKpis] = useState<FarmDashboardKPIs | null>(null);
  const [stockList, setStockList] = useState<FarmStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadData() {
    try {
      const [kpiRes, stockRes] = await Promise.all([
        farmService.getDashboard(),
        farmService.getStockOverview(),
      ]);
      setKpis(kpiRes.data);
      setStockList(stockRes.data || []);
    } catch (err) {
      console.error("Failed to load farm dashboard:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Farm Tracking Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Quantity and tray tracking overview for farm products (Non-Financial)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/farm/report">
            <Button variant="outline" size="sm" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Farm Report
            </Button>
          </Link>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Production */}
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-xl shrink-0">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 truncate">
                Today's Production
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {kpis?.today_production ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Units Produced</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Trays */}
        <Card className="glass-card border-teal-500/30 bg-teal-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-teal-500/20 text-teal-600 rounded-xl shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 truncate">
                Today's Trays
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {kpis?.today_trays ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Trays Collected</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Delivery */}
        <Card className="glass-card border-blue-500/30 bg-blue-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-blue-500/20 text-blue-600 rounded-xl shrink-0">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 truncate">
                Today's Delivery
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {kpis?.today_delivered ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Transferred Out</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Waste */}
        <Card className="glass-card border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-rose-500/20 text-rose-600 rounded-xl shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 truncate">
                Today's Waste
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {kpis?.today_waste ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Loss / Breakage</p>
            </div>
          </CardContent>
        </Card>

        {/* Current Farm Stock */}
        <Card className="glass-card border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-3">
            <div className="p-3 bg-primary/20 text-primary rounded-xl shrink-0">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
                Current Farm Stock
              </p>
              <h3 className="text-2xl font-extrabold text-foreground truncate">
                {kpis?.current_farm_stock ?? 0}
              </h3>
              <p className="text-[11px] text-muted-foreground">Total In Farm</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/farm/production" className="group">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Record Production</h4>
                <p className="text-xs text-muted-foreground">Log eggs or trays collected today</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link href="/farm/delivery" className="group">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Record Delivery</h4>
                <p className="text-xs text-muted-foreground">Transfer eggs to shop or branch</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link href="/farm/waste" className="group">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-rose-500/50 hover:bg-rose-500/5 transition-all shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 group-hover:bg-rose-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Record Waste / Loss</h4>
                <p className="text-xs text-muted-foreground">Log broken, cracked, or rotten items</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Live Farm Stock by Product Table */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-6">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Farm Stock by Product</CardTitle>
            <p className="text-xs text-muted-foreground">
              Opening + Production - Delivery - Waste = Current Farm Stock
            </p>
          </div>
          <Link href="/farm/report">
            <Button variant="ghost" size="sm" className="text-xs">
              View Detailed Report <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 text-right">Opening Stock</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Total Production (+)</th>
                  <th className="px-4 py-3 text-right text-blue-600">Total Delivery (-)</th>
                  <th className="px-4 py-3 text-right text-rose-600">Total Waste (-)</th>
                  <th className="px-4 py-3 text-right font-bold text-foreground">Current Farm Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No farm products configured yet. Go to{" "}
                      <Link href="/products/new" className="text-primary underline">
                        Product Management
                      </Link>{" "}
                      to create a Farm Product.
                    </td>
                  </tr>
                ) : (
                  stockList.map((item) => (
                    <tr key={item.product_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center space-x-2">
                          <span>{item.name}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-600 bg-amber-500/10">
                            FARM
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{item.product_code}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground font-medium">
                        {item.opening_stock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        +{item.total_production} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        -{item.total_delivery} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        -{item.total_waste} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-foreground text-sm">
                        <span className={item.current_stock > 0 ? "text-emerald-600" : "text-destructive"}>
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
