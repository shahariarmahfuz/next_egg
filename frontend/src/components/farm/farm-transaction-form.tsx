"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { farmService, productService } from "@/services/api";
import { ProductItem } from "@/types";
import { useRouter } from "next/navigation";

const farmSchema = z.object({
  product_id: z.string().min(1, "Farm Product is required"),
  transaction_date: z.string().min(1, "Date is required"),
  tray_count: z.coerce.number().optional(),
  units_per_tray: z.coerce.number().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  destination: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

interface Props {
  type: "PRODUCTION" | "DELIVERY" | "WASTE";
  onSuccess?: () => void;
  redirectOnSuccess?: boolean;
}

export function FarmTransactionForm({ type, onSuccess, redirectOnSuccess = false }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split("T")[0],
      quantity: 0,
      tray_count: 0,
      units_per_tray: 30, // Default 30 eggs per tray
      reason: "",
      destination: "",
      notes: "",
    }
  });

  const tray_count = watch("tray_count") || 0;
  const units_per_tray = watch("units_per_tray") || 0;
  const selectedProductId = watch("product_id");
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Automatically calculate total quantity from trays * units_per_tray when both are positive
  useEffect(() => {
    if ((type === "PRODUCTION" || type === "DELIVERY") && tray_count > 0 && units_per_tray > 0) {
      setValue("quantity", Number((tray_count * units_per_tray).toFixed(2)));
    }
  }, [tray_count, units_per_tray, type, setValue]);

  useEffect(() => {
    async function fetchProducts() {
      setIsProductsLoading(true);
      try {
        const res = await productService.getProducts({ size: 100, product_type: "FARM", status: "active" });
        setProducts(res.data?.items || []);
        if (res.data?.items?.length > 0) {
          setValue("product_id", res.data.items[0].id);
        }
      } catch (err: any) {
        console.error("Failed to fetch farm products", err);
        toast.error("Failed to load farm products catalog.");
      } finally {
        setIsProductsLoading(false);
      }
    }
    fetchProducts();
  }, [setValue]);

  const onSubmit = async (data: FarmFormValues) => {
    setLoading(true);
    try {
      if (type === "PRODUCTION") {
        await farmService.createProduction({
          product_id: data.product_id,
          transaction_date: data.transaction_date,
          tray_count: data.tray_count && data.tray_count > 0 ? data.tray_count : undefined,
          units_per_tray: data.units_per_tray && data.units_per_tray > 0 ? data.units_per_tray : undefined,
          quantity: data.quantity,
          notes: data.notes?.trim() || undefined,
        });
        toast.success(`Production of ${data.quantity} recorded successfully!`);
      } else if (type === "DELIVERY") {
        await farmService.createDelivery({
          product_id: data.product_id,
          transaction_date: data.transaction_date,
          tray_count: data.tray_count && data.tray_count > 0 ? data.tray_count : undefined,
          units_per_tray: data.units_per_tray && data.units_per_tray > 0 ? data.units_per_tray : undefined,
          quantity: data.quantity,
          destination: data.destination || undefined,
          notes: data.notes?.trim() || undefined,
        });
        toast.success(`Delivery of ${data.quantity} recorded successfully!`);
      } else if (type === "WASTE") {
        await farmService.createWaste({
          product_id: data.product_id,
          transaction_date: data.transaction_date,
          quantity: data.quantity,
          reason: data.reason || undefined,
          notes: data.notes?.trim() || undefined,
        });
        toast.success(`Waste of ${data.quantity} recorded successfully!`);
      }

      // Reset form quantity and counters
      setValue("quantity", 0);
      setValue("tray_count", 0);
      setValue("notes", "");
      setValue("destination", "");
      setValue("reason", "");

      // Refresh product list to update in-memory stock indicator
      const refreshRes = await productService.getProducts({ size: 100, product_type: "FARM", status: "active" });
      setProducts(refreshRes.data?.items || []);

      if (onSuccess) {
        onSuccess();
      }

      if (redirectOnSuccess) {
        router.push("/farm");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred while recording the farm transaction.");
    } finally {
      setLoading(false);
    }
  };

  const isTrayCalculationActive = (type === "PRODUCTION" || type === "DELIVERY") && tray_count > 0 && units_per_tray > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-card p-6 rounded-xl shadow-sm border border-border">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {type === "PRODUCTION" && "Add Farm Production"}
              {type === "DELIVERY" && "Record Farm Delivery / Distribution"}
              {type === "WASTE" && "Record Farm Waste / Breakage / Loss"}
            </h3>
            <p className="text-xs text-muted-foreground">Quantity Tracking Only (Non-Financial)</p>
          </div>
        </div>

        {selectedProduct && (
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Current Stock:</span>
            <span className="ml-1.5 font-bold text-sm text-foreground">
              {selectedProduct.current_stock} {selectedProduct.unit}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Farm Product Dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Farm Product *</label>
          <select
            {...register("product_id")}
            disabled={isProductsLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isProductsLoading ? (
              <option value="">Loading farm products...</option>
            ) : products.length === 0 ? (
              <option value="">No active farm products found (Add in Product module first)</option>
            ) : (
              products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.product_code}] (Stock: {p.current_stock} {p.unit})
                </option>
              ))
            )}
          </select>
          {errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
        </div>

        {/* Date Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Transaction Date *</label>
          <Input type="date" {...register("transaction_date")} />
          {errors.transaction_date && <p className="text-xs text-destructive">{errors.transaction_date.message}</p>}
        </div>

        {/* Trays & Units per Tray (for PRODUCTION or DELIVERY) */}
        {(type === "PRODUCTION" || type === "DELIVERY") && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Trays (Optional)</label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 100"
                {...register("tray_count")}
              />
              <span className="text-[11px] text-muted-foreground">Number of trays</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Eggs per Tray</label>
              <Input
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 30"
                {...register("units_per_tray")}
              />
              <span className="text-[11px] text-muted-foreground">Standard capacity (default: 30)</span>
            </div>
          </>
        )}

        {/* Destination (for DELIVERY) */}
        {type === "DELIVERY" && (
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Destination / Receiver *</label>
            <Input
              type="text"
              list="destination-suggestions"
              placeholder="e.g. Main Shop, Branch 1, Dealer Rahim, Market"
              {...register("destination")}
            />
            <datalist id="destination-suggestions">
              <option value="Own Shop" />
              <option value="Branch 1" />
              <option value="Branch 2" />
              <option value="Dealer / Distributor" />
              <option value="Wholesale Market" />
              <option value="Retail Outlet" />
            </datalist>
            <span className="text-[11px] text-muted-foreground">Specify where the eggs/products were transferred</span>
          </div>
        )}

        {/* Reason (for WASTE) */}
        {type === "WASTE" && (
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Reason for Waste / Loss</label>
            <select
              {...register("reason")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a reason...</option>
              <option value="Broken / Cracked Eggs">Broken / Cracked Eggs</option>
              <option value="Spoiled / Rotten">Spoiled / Rotten</option>
              <option value="Crushed in Transport">Crushed in Transport</option>
              <option value="Incubator Rejection">Incubator Rejection</option>
              <option value="Other Damage">Other Damage</option>
            </select>
          </div>
        )}

        {/* Total Quantity */}
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Total Quantity ({selectedProduct?.unit || "units"}) *
            </label>
            {isTrayCalculationActive && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                Auto-calculated: {tray_count} trays × {units_per_tray} = {tray_count * units_per_tray}
              </span>
            )}
          </div>
          <Input
            type="number"
            min="0.01"
            step="any"
            readOnly={isTrayCalculationActive}
            className={isTrayCalculationActive ? "bg-muted font-bold text-foreground" : "font-bold text-foreground"}
            placeholder="e.g. 3000"
            {...register("quantity")}
          />
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
        </div>
      </div>

      {/* Notes / Remarks */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Notes / Remarks (Optional)</label>
        <Textarea
          {...register("notes")}
          placeholder="Optional notes or details regarding this transaction..."
          className="h-20"
        />
      </div>

      <Button type="submit" disabled={loading || isProductsLoading || products.length === 0} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving Transaction...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Record {type === "PRODUCTION" ? "Farm Production" : type === "DELIVERY" ? "Farm Delivery" : "Farm Waste"}
          </>
        )}
      </Button>
    </form>
  );
}
