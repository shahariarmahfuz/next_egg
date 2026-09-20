'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  PlusCircle,
  Plus,
  Loader2,
  Layers,
  Truck,
  BarChart3,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { farmService } from "@/services/api";
import { FarmBalanceItem } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function ProductionPage() {
  const { hasPermission } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  // Farms Dropdown State
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  // Form State
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [productionDate, setProductionDate] = useState(todayStr);
  const [trayQuantity, setTrayQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFarms = async () => {
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
    } finally {
      setLoadingFarms(false);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleAddProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      toast.error("Please select a Farm");
      return;
    }

    if (!productionDate) {
      toast.error("Please select a Date");
      return;
    }

    const qty = parseFloat(trayQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Tray Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await farmService.createProduction({
        farm_id: selectedFarmId,
        production_date: productionDate,
        tray_quantity: qty,
      });

      if (res.success) {
        toast.success("Production recorded successfully");
        setTrayQuantity(""); // Clear tray input
        fetchFarms(); // Refresh live balances
      } else {
        toast.error(res.message || "Failed to record production");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to record production";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HasPermission
      code={["farm.production.create", "farm.production.view", "farm.view"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Production.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-amber-500/10 text-amber-600 rounded-lg sm:rounded-xl shrink-0">
              <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Production</h1>
              <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Add produced trays to increase available stock for the selected farm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(["farm.production.view", "production.view"]) && (
              <Link href="/farm/production/manage">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                  Manage Production
                </Button>
              </Link>
            )}
            {hasPermission(["farm.view", "farm.create", "farm.edit", "farm.delete"]) && (
              <Link href="/farm">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Manage Farm
                </Button>
              </Link>
            )}
            {hasPermission(["farm.delivery.view", "farm.delivery.create"]) && (
              <Link href="/farm/delivery">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <Truck className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                  Delivery
                </Button>
              </Link>
            )}
            {hasPermission("farm.report") && (
              <Link href="/farm/report">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                  Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Form Card */}
        {hasPermission("farm.production.create") && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border">
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                Add Production
              </CardTitle>
              <CardDescription className="hidden sm:block text-xs text-muted-foreground">
                Record harvested or produced egg trays for the selected farm.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5">
              <form onSubmit={handleAddProduction} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                  {/* Farm Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Farm <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={selectedFarmId}
                      onChange={(e) => setSelectedFarmId(e.target.value)}
                      disabled={loadingFarms || submitting}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {loadingFarms ? (
                        <option value="">Loading farms...</option>
                      ) : farms.length === 0 ? (
                        <option value="">No farms available</option>
                      ) : (
                        farms.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} (Available: {f.available_tray} trays)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      Date <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={productionDate}
                      onChange={(e) => setProductionDate(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Tray Quantity */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Tray Quantity <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="e.g. 100"
                      value={trayQuantity}
                      onChange={(e) => setTrayQuantity(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={submitting || !selectedFarmId || !trayQuantity}
                    className="w-full sm:w-auto h-9 min-w-[140px] text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Production
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </HasPermission>
  );
}
