"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  User,
  Phone,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  CreditCard,
  Hash,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { supplierService, supplierPaymentService } from "@/services/api";
import { SupplierItem, SupplierFinancialSummary, SupplierPaymentItem } from "@/types";
import { formatCurrency } from "./supplier-payment-export-utils";

const supplierPaymentFormSchema = z.object({
  supplier_id: z.string().min(1, "Supplier selection is required"),
  amount: z.number().gt(0, "Payment amount must be greater than zero"),
  payment_method: z.string().min(1, "Payment method is required"),
  reference_no: z.string().optional(),
  payment_date: z.string().min(1, "Payment date is required"),
  notes: z.string().optional(),
});

export type SupplierPaymentFormValues = z.infer<typeof supplierPaymentFormSchema>;

interface SupplierPaymentFormProps {
  initialData?: SupplierPaymentItem;
  onSubmit: (values: SupplierPaymentFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function SupplierPaymentForm({ initialData, onSubmit, isSubmitting }: SupplierPaymentFormProps) {
  const [supplierSearch, setSupplierSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialData?.supplier_id || "");

  // Debounce supplier search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(supplierSearch), 300);
    return () => clearTimeout(handler);
  }, [supplierSearch]);

  // Query suppliers list
  const { data: suppliersSearchData, isLoading: isSearchingSuppliers } = useQuery({
    queryKey: ["suppliers-search-select", debouncedSearch],
    queryFn: () => supplierService.getSuppliers({ search: debouncedSearch || undefined, size: 20 }),
  });

  const searchedSuppliers: SupplierItem[] = suppliersSearchData?.data?.items || [];

  // Query Supplier Live Financial Summary (Total Purchase, Total Paid, Current Due)
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["supplier-financial-summary", selectedSupplierId],
    queryFn: () => supplierPaymentService.getSupplierFinancialSummary(selectedSupplierId),
    enabled: !!selectedSupplierId,
  });

  const financialSummary: SupplierFinancialSummary | undefined = summaryData?.data;

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<SupplierPaymentFormValues>({
    resolver: zodResolver(supplierPaymentFormSchema),
    defaultValues: {
      supplier_id: initialData?.supplier_id || "",
      amount: initialData?.amount || undefined,
      payment_method: initialData?.payment_method || "cash",
      reference_no: initialData?.reference_no || "",
      payment_date: initialData?.payment_date
        ? new Date(initialData.payment_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      notes: initialData?.notes || "",
    },
  });

  const enteredAmount = watch("amount");

  const handleSelectSupplier = (supp: SupplierItem) => {
    setSelectedSupplierId(supp.id);
    setValue("supplier_id", supp.id);
  };

  const handleFormSubmit = async (values: SupplierPaymentFormValues) => {
    const currentDue = financialSummary?.current_due || 0;
    const maxAllowed = initialData ? currentDue + initialData.amount : currentDue;

    if (values.amount > maxAllowed) {
      setError("amount", {
        type: "manual",
        message: `Payment amount (${formatCurrency(values.amount)}) cannot exceed supplier current due (${formatCurrency(maxAllowed)})`,
      });
      return;
    }

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Supplier Search & Selection */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            1. Search & Select Supplier
          </CardTitle>
          <CardDescription>
            Search supplier by Company Name, Phone, or Supplier Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initialData && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search supplier by name, phone, code..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="pl-9 pr-4 py-2"
              />
            </div>
          )}

          {/* Search Dropdown / List */}
          {!initialData && !selectedSupplierId && (
            <div className="border rounded-xl max-h-48 overflow-y-auto divide-y bg-card/60 backdrop-blur">
              {isSearchingSuppliers ? (
                <div className="p-4 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching suppliers directory...
                </div>
              ) : searchedSuppliers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No suppliers found matching "{supplierSearch}"
                </div>
              ) : (
                searchedSuppliers.map((supp) => (
                  <button
                    key={supp.id}
                    type="button"
                    onClick={() => handleSelectSupplier(supp)}
                    className="w-full text-left p-3 hover:bg-accent/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                        <span>{supp.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {supp.supplier_code}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {supp.phone || "No Phone"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-muted-foreground font-semibold">Current Due</div>
                      <div className="text-sm font-bold text-amber-500">
                        {formatCurrency(supp.current_balance)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Supplier Banner */}
          {selectedSupplierId && (
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {financialSummary?.supplier_name?.charAt(0) || "S"}
                </div>
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <span>{financialSummary?.supplier_name || initialData?.supplier?.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {financialSummary?.supplier_code || initialData?.supplier?.supplier_code}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {financialSummary?.phone || initialData?.supplier?.phone || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {!initialData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSupplierId("");
                    setValue("supplier_id", "");
                  }}
                >
                  Change Supplier
                </Button>
              )}
            </div>
          )}

          {errors.supplier_id && (
            <p className="text-xs text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.supplier_id.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Supplier Financial Stats Cards */}
      {selectedSupplierId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Total Purchase
              </span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <span className="text-2xl font-extrabold text-foreground ">
                  {formatCurrency(financialSummary?.total_purchases)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Total Paid
              </span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <span className="text-2xl font-extrabold text-emerald-500 ">
                  {formatCurrency(financialSummary?.total_paid)}
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Current Due
              </span>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <span className="text-2xl font-extrabold text-amber-500 ">
                  {formatCurrency(financialSummary?.current_due)}
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Payment Details Inputs */}
      {selectedSupplierId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              3. Payment Entry & Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <label htmlFor="amount" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  Payment Amount ($) *
                </label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...register("amount", { valueAsNumber: true })}
                  className="text-lg font-bold text-emerald-500"
                />
                {errors.amount && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {errors.amount.message}
                  </p>
                )}
                {enteredAmount && financialSummary && (
                  <p className="text-[11px] text-muted-foreground ">
                    Remaining due after payment:{" "}
                    <strong className="text-foreground">
                      {formatCurrency(Math.max(0, financialSummary.current_due - enteredAmount))}
                    </strong>
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label htmlFor="payment_method" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Payment Method *
                </label>
                <select
                  id="payment_method"
                  {...register("payment_method")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="mobile_wallet">Mobile Wallet</option>
                </select>
                {errors.payment_method && (
                  <p className="text-xs text-destructive">{errors.payment_method.message}</p>
                )}
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <label htmlFor="payment_date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Payment Date *
                </label>
                <Input id="payment_date" type="datetime-local" {...register("payment_date")} />
                {errors.payment_date && (
                  <p className="text-xs text-destructive">{errors.payment_date.message}</p>
                )}
              </div>

              {/* Reference Number */}
              <div className="space-y-1.5">
                <label htmlFor="reference_no" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  Reference Number (Optional)
                </label>
                <Input
                  id="reference_no"
                  type="text"
                  placeholder="Bank TRX ID, Cheque #, Receipt #"
                  {...register("reference_no")}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5 pt-2">
              <label htmlFor="notes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Notes / Remarks
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="Payment voucher description..."
                {...register("notes")}
                className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button
                type="submit"
                disabled={isSubmitting || !selectedSupplierId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-6 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {initialData ? "Update Payment Voucher" : "Save Supplier Payment"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
