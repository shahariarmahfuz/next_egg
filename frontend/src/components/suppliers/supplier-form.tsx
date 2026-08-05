"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Truck, Save, ArrowLeft, Info, User, Hash, Phone, MapPin } from "lucide-react";
import { SupplierItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(150),
  supplier_code: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  opening_balance: z.coerce.number().min(0, "Opening due cannot be negative"),
  current_balance: z.coerce.number().min(0, "Current due cannot be negative").optional(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  initialData?: SupplierItem;
  isEdit?: boolean;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
}

export function SupplierForm({
  initialData,
  isEdit = false,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: initialData?.name || "",
      supplier_code: initialData?.supplier_code || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      opening_balance: initialData?.opening_balance ?? 0,
      current_balance: initialData?.current_balance ?? 0,
      status: initialData?.status || "active",
      notes: initialData?.notes || "",
    },
  });

  const openingDueValue = watch("opening_balance");

  const handleFormSubmit: SubmitHandler<SupplierFormValues> = async (values) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(values);
    } catch (err: any) {
      const msg = err.message || "Failed to save supplier profile.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-card border-border/50 shadow-xl max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">
              {isEdit ? `Edit Supplier (${initialData?.supplier_code})` : "Add New Supplier"}
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Directory
          </Button>
        </div>
        <CardDescription>
          {isEdit
            ? "Update supplier profile and contact information."
            : "Register a new vendor/supplier profile. Opening due balance initializes current due."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMsg && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Primary Profile Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">
              Supplier Identity & Contact
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-primary" /> Supplier Name *
                </label>
                <Input {...register("name")} placeholder="e.g. Apex Global Traders" />
                {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5 text-primary" /> Supplier Code (Auto Generated)
                </label>
                <Input {...register("supplier_code")} placeholder="e.g. SUP-00100" disabled={isEdit} />
                {errors.supplier_code && <p className="text-[11px] text-destructive">{errors.supplier_code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number (Optional)
                </label>
                <Input {...register("phone")} placeholder="e.g. +1 800 555 0199" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Physical Address (Optional)
                </label>
                <Input {...register("address")} placeholder="Street address, city, region, postal code..." />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Supplier Status *</label>
                <select
                  {...register("status")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Account & Opening Due Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">
              Opening Account & Balance ($)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isEdit ? (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium">Opening Due Amount ($) *</label>
                  <Input {...register("opening_balance")} type="number" step="0.01" min="0" placeholder="0.00" />
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <span>Opening due will automatically set initial Current Due balance (${openingDueValue || 0}).</span>
                  </div>
                  {errors.opening_balance && (
                    <p className="text-[11px] text-destructive">{errors.opening_balance.message}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Opening Due (Read-only)</label>
                    <Input value={initialData?.opening_balance ?? 0} disabled className="opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Current Outstanding Due ($) *</label>
                    <Input {...register("current_balance")} type="number" step="0.01" min="0" />
                    {errors.current_balance && (
                      <p className="text-[11px] text-destructive">{errors.current_balance.message}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Additional Notes (Optional)</label>
              <textarea
                {...register("notes")}
                rows={2}
                placeholder="Payment terms, bank details, or contact person details..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Supplier...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? "Update Supplier" : "Save Supplier"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
