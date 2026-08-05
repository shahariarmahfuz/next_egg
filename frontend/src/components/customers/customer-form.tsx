"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Users, Save, ArrowLeft, Info, Phone, MapPin } from "lucide-react";
import { CustomerItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const customerSchema = z.object({
  name: z.string().min(2, "Customer full name must be at least 2 characters").max(150),
  phone: z.string().optional(),
  customer_code: z.string().optional(),
  address: z.string().optional(),
  opening_balance: z.coerce.number().min(0, "Opening due balance cannot be negative"),
  status: z.enum(["active", "inactive"]).optional(),
  notes: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialData?: CustomerItem;
  isEdit?: boolean;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  onCancel: () => void;
}

export function CustomerForm({
  initialData,
  isEdit = false,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialData?.name || "",
      phone: initialData?.phone || "",
      customer_code: initialData?.customer_code || "",
      address: initialData?.address || "",
      opening_balance: initialData?.opening_balance ?? 0,
      status: initialData?.status || "active",
      notes: initialData?.notes || "",
    },
  });

  const handleFormSubmit = async (values: CustomerFormValues) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(values);
    } catch (err: any) {
      const msg = err.message || "Failed to save customer profile.";
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
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">
              {isEdit ? `Edit Customer (${initialData?.customer_code})` : "Add New Customer"}
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Directory
          </Button>
        </div>
        <CardDescription>
          {isEdit
            ? "Update customer profile, contact information, and status."
            : "Register a new client profile. Opening Due balance will automatically set the starting due amount."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMsg && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Identity Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">Customer Profile & Contact</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Full Name *</label>
                <Input {...register("name")} placeholder="e.g. John Doe" />
                {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number (Optional)
                </label>
                <Input {...register("phone")} placeholder="e.g. +18005550199" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Customer Code (Auto Generated)</label>
                <Input {...register("customer_code")} placeholder="e.g. CUST-00001" disabled={isEdit} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Physical Address (Optional)
                </label>
                <Input {...register("address")} placeholder="e.g. 123 Commercial Ave, Suite 400, New York, NY" />
              </div>

              {isEdit && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Customer Status</label>
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

          {/* Financial Account Parameters */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold border-b pb-2 text-foreground">Financial Dues</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Opening Due Balance ($)</label>
                <Input
                  {...register("opening_balance")}
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={isEdit}
                />
                {isEdit ? (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                    <Info className="h-3 w-3 text-amber-500" /> Current Due (${initialData?.current_balance}) is calculated dynamically from sales and collections.
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Starting receivable due balance upon customer onboarding.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium">Notes & Customer Preferences (Optional)</label>
            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Special credit terms, delivery preferences, or contact notes..."
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
                  Saving Customer...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? "Update Customer" : "Add Customer"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
