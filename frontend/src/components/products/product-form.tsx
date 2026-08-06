"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Package, Save, ArrowLeft, Info, Barcode, Layers, Tag } from "lucide-react";
import { ProductItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(200),
  unit: z.string().min(1, "Unit of measurement is required e.g. pcs, kg"),
  opening_stock_unit_cost: z.coerce.number().min(0, "Opening stock unit cost cannot be negative"),
  selling_price: z.coerce.number().min(0, "Selling price cannot be negative"),
  product_code: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  opening_stock: z.coerce.number().min(0, "Opening stock cannot be negative"),
  minimum_stock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: ProductItem;
  isEdit?: boolean;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({
  initialData,
  isEdit = false,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || "",
      unit: initialData?.unit || "pcs",
      opening_stock_unit_cost: initialData?.opening_stock_unit_cost ?? 0,
      selling_price: initialData?.selling_price ?? 0,
      product_code: initialData?.product_code || "",
      category: initialData?.category || "",
      brand: initialData?.brand || "",
      barcode: initialData?.barcode || "",
      opening_stock: initialData?.opening_stock ?? 0,
      minimum_stock: initialData?.minimum_stock ?? 5,
      status: initialData?.status || "active",
      notes: initialData?.notes || "",
    },
  });

  const handleFormSubmit = async (values: ProductFormValues) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(values);
    } catch (err: any) {
      const msg = err.message || "Failed to save product.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-card border-border/50 shadow-xl max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">
              {isEdit ? `Edit Product (${initialData?.product_code})` : "Add New Product"}
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Catalog
          </Button>
        </div>
        <CardDescription>
          {isEdit
            ? "Modify product details, category, brand, prices, and minimum alert levels. Stock is maintained automatically through Purchases and Sales."
            : "Register a new product item in your inventory catalog."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMsg && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* General Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">General Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Product Name *</label>
                <Input {...register("name")} placeholder="e.g. Premium Cotton T-Shirt" />
                {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Product Code (Auto Generated)</label>
                <Input {...register("product_code")} placeholder="e.g. PRD-00001" disabled={isEdit} />
                {errors.product_code && <p className="text-[11px] text-destructive">{errors.product_code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Unit of Measurement *</label>
                <Input {...register("unit")} placeholder="e.g. pcs, kg, box, ton, meter" />
                {errors.unit && <p className="text-[11px] text-destructive">{errors.unit.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Category (Optional)</label>
                <Input {...register("category")} placeholder="e.g. Apparel, Construction, Electronics" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Brand (Optional)</label>
                <Input {...register("brand")} placeholder="e.g. Nike, Holcim, Samsung" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Barcode className="h-3.5 w-3.5 text-primary" /> Barcode (Optional, Unique)
                </label>
                <Input {...register("barcode")} placeholder="e.g. 8901234567890" />
                {errors.barcode && <p className="text-[11px] text-destructive">{errors.barcode.message}</p>}
              </div>
            </div>
          </div>

          {/* Pricing & Stock Configuration */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">Pricing & Stock Control</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Opening Stock Unit Cost ($) *</label>
                <Input {...register("opening_stock_unit_cost")} type="number" step="0.01" min="0" />
                {errors.opening_stock_unit_cost && <p className="text-[11px] text-destructive">{errors.opening_stock_unit_cost.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Default Selling Price ($) *</label>
                <Input {...register("selling_price")} type="number" step="0.01" min="0" />
                {errors.selling_price && <p className="text-[11px] text-destructive">{errors.selling_price.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Opening Stock</label>
                <Input
                  {...register("opening_stock")}
                  type="number"
                  step="1"
                  min="0"
                  disabled={isEdit}
                />
                {isEdit ? (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                    <Info className="h-3 w-3 text-amber-500" /> Current Stock ({initialData?.current_stock} {initialData?.unit}) is maintained automatically through Purchases and Sales.
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Initial stock upon catalog creation. Sets starting inventory.
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Minimum Stock Alert Threshold</label>
                <Input {...register("minimum_stock")} type="number" step="1" min="0" />
                {errors.minimum_stock && <p className="text-[11px] text-destructive">{errors.minimum_stock.message}</p>}
              </div>

              {isEdit && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium">Catalog Status</label>
                  <select
                    {...register("status")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium">Product Description / Notes (Optional)</label>
            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Specifications, supplier guidelines, or storage instructions..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Product...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? "Update Product" : "Add Product"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
