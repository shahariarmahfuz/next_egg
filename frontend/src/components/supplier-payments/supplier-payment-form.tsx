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
      notes: initialData?.notes || (initialData as any)?.note || "",
    },
  });

  const enteredAmount = watch("amount");

  const handleSelectSupplier = (supp: SupplierItem) => {
    setSelectedSupplierId(supp.id);
    setValue("supplier_id", supp.id);
  };

  const handleFormSubmit = async (values: SupplierPaymentFormValues) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Supplier Search & Selection */}
      <Card className="glass-card w-full max-w-full overflow-hidden">
        <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <span>1. Search & Select Supplier</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Search supplier by Company Name, Phone, or Supplier Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
          {!initialData && (
            <div className="relative w-full max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none shrink-0" />
              <Input
                type="text"
                placeholder="Search supplier by name, phone, code..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full max-w-full pl-9 pr-4 py-2 text-xs sm:text-sm h-10 box-border"
                style={{ width: "100%", maxWidth: "100%" }}
              />
            </div>
          )}

          {/* Search Dropdown / List */}
          {!initialData && !selectedSupplierId && (
            <div
              className="border rounded-xl max-h-64 md:max-h-48 overflow-y-auto overflow-x-hidden divide-y bg-card/60 backdrop-blur w-full max-w-full overscroll-contain"
              style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
            >
              {isSearchingSuppliers ? (
                <div className="p-4 flex items-center justify-center text-xs sm:text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching suppliers directory...
                </div>
              ) : searchedSuppliers.length === 0 ? (
                <div className="p-4 text-center text-xs sm:text-sm text-muted-foreground">
                  No suppliers found matching "{supplierSearch}"
                </div>
              ) : (
                searchedSuppliers.map((supp) => (
                  <button
                    key={supp.id}
                    type="button"
                    onClick={() => handleSelectSupplier(supp)}
                    className="w-full max-w-full text-left p-3 hover:bg-accent/60 active:bg-accent/80 transition-colors group cursor-pointer touch-manipulation min-h-[44px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {/* Mobile-First Layout (< 768px / max-width: 767px) */}
                    <div className="flex flex-col gap-0.5 w-full min-w-0 md:hidden text-left">
                      {/* 1. Supplier Name */}
                      <div
                        className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate"
                        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        title={supp.name}
                      >
                        {supp.name}
                      </div>

                      {/* 2. Supplier Code · Phone */}
                      <div
                        className="text-xs text-muted-foreground truncate"
                        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        <span>{supp.supplier_code}</span>
                        <span className="mx-1.5 font-bold text-muted-foreground/60">·</span>
                        <span>{supp.phone && supp.phone.trim() ? supp.phone.trim() : "No Phone"}</span>
                      </div>

                      {/* 3. Current Due */}
                      <div className="text-xs font-medium text-muted-foreground pt-0.5 truncate">
                        Current Due:{" "}
                        <span
                          className={`font-bold ${
                            supp.current_balance < 0 ? "text-emerald-500" : "text-amber-500"
                          }`}
                        >
                          {formatCurrency(supp.current_balance)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop Layout (>= 768px / md:flex) - Preserved exactly as original */}
                    <div className="hidden md:flex items-center justify-between w-full">
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
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Supplier Banner */}
          {selectedSupplierId && (
            <div className="p-3.5 sm:p-4 rounded-xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full max-w-full">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm sm:text-base shrink-0">
                  {financialSummary?.supplier_name?.charAt(0) || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Mobile presentation (< 768px) */}
                  <div className="md:hidden min-w-0">
                    <div
                      className="font-bold text-sm text-foreground truncate"
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      title={financialSummary?.supplier_name || initialData?.supplier?.name}
                    >
                      {financialSummary?.supplier_name || initialData?.supplier?.name}
                    </div>
                    <div
                      className="text-xs text-muted-foreground truncate mt-0.5"
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      <span>{financialSummary?.supplier_code || initialData?.supplier?.supplier_code}</span>
                      <span className="mx-1 text-muted-foreground/60">·</span>
                      <span>{financialSummary?.phone || initialData?.supplier?.phone || "No Phone"}</span>
                    </div>
                  </div>

                  {/* Desktop presentation (>= 768px) */}
                  <div className="hidden md:block">
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
                  className="w-full sm:w-auto text-xs h-8 sm:h-9 shrink-0"
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
