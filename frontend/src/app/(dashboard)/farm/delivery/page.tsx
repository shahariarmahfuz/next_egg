'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Loader2,
  Layers,
  PlusCircle,
  BarChart3,
  Calendar,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { farmService } from "@/services/api";
import { FarmBalanceItem } from "@/types";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function DeliveryPage() {
  const { hasPermission } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  // Farms Dropdown State
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  // Form State
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [trayQuantity, setTrayQuantity] = useState("");
  const [destination, setDestination] = useState("");
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

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      toast.error("Please select a Farm");
      return;
    }

    if (!deliveryDate) {
      toast.error("Please select a Date");
      return;
    }

    const qty = parseFloat(trayQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Tray Quantity must be greater than 0");
      return;
    }

    const destTrimmed = destination.trim();
    if (!destTrimmed) {
      toast.error("Store / Destination Name is required");
      return;
    }

    // Check against current selected farm balance
    const currentFarm = farms.find((f) => f.id === selectedFarmId);
    if (currentFarm && qty > currentFarm.available_tray) {
      toast.error(
        `Insufficient trays. Farm "${currentFarm.name}" only has ${currentFarm.available_tray} available trays.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await farmService.createDelivery({
        farm_id: selectedFarmId,
        delivery_date: deliveryDate,
        destination: destTrimmed,
        tray_quantity: qty,
      });

      if (res.success) {
        toast.success("Delivery recorded successfully");
        setTrayQuantity("");
        setDestination("");
        fetchFarms(); // Refresh live balances
      } else {
        toast.error(res.message || "Failed to record delivery");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to record delivery";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const currentFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <HasPermission
      code={["farm.delivery.create", "farm.delivery.view", "farm.view"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Delivery.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-blue-500/10 text-blue-600 rounded-lg sm:rounded-xl shrink-0">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Delivery</h1>
              <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Record tray deliveries to stores or branches (deducts from farm available stock)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(["farm.delivery.view", "delivery.view"]) && (
              <Link href="/farm/delivery/manage">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Manage Delivery
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
            {hasPermission(["farm.production.view", "farm.production.create"]) && (
              <Link href="/farm/production">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  Production
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
        {hasPermission("farm.delivery.create") && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                    Record Delivery
                  </CardTitle>
                  <CardDescription className="hidden sm:block text-xs text-muted-foreground">
                    Deduct trays from farm available balance and record destination.
                  </CardDescription>
                </div>
                {currentFarm && (
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Available Stock:</span>
                    <span className="text-xs sm:text-sm font-bold text-blue-600 font-mono">
                      {currentFarm.available_tray} Trays
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5">
              <form onSubmit={handleAddDelivery} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
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
                            {f.name} ({f.available_tray} available)
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
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
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
                      placeholder="e.g. 50"
                      value={trayQuantity}
                      onChange={(e) => setTrayQuantity(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9 font-mono"
                    />
                  </div>

                  {/* Store / Destination */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Destination / Store <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Shop, Ayonal"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={submitting}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <p className="text-[11px] text-muted-foreground text-center sm:text-left">
                    Each submission creates one delivery record and updates stock.
                  </p>
                  <Button
                    type="submit"
                    disabled={submitting || !selectedFarmId || !trayQuantity || !destination.trim()}
                    className="w-full sm:w-auto h-9 min-w-[140px] text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Delivery
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
