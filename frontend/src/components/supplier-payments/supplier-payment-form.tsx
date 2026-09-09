"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  User,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  CreditCard,
  Hash,
  ChevronsUpDown,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { supplierService, supplierPaymentService } from "@/services/api";
import { SupplierItem, SupplierFinancialSummary, SupplierPaymentItem } from "@/types";
import { formatCurrency } from "./supplier-payment-export-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

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
  const [openSupplierPopover, setOpenSupplierPopover] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialData?.supplier_id || "");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(initialData?.supplier || null);

  const debouncedSearch = useDebounce(supplierSearch, 300);

  // Query suppliers list
  const { data: suppliersSearchData, isLoading: isSearchingSuppliers } = useQuery({
    queryKey: ["suppliers-search-select", debouncedSearch],
    queryFn: () => supplierService.getSuppliers({ search: debouncedSearch || undefined, size: 20 }),
  });

  const searchedSuppliers: SupplierItem[] = suppliersSearchData?.data?.items || [];

  // Query Supplier Live Financial Summary (Current Due)
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
    clearErrors,
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

  // Sync supplier details if loaded from summary in edit mode or when missing
  useEffect(() => {
    if (financialSummary && !selectedSupplier) {
      setSelectedSupplier({
        id: financialSummary.supplier_id,
        supplier_code: financialSummary.supplier_code,
        name: financialSummary.supplier_name,
        phone: financialSummary.phone,
        opening_balance: 0,
        current_balance: financialSummary.current_due,
        status: "active",
        created_at: "",
        updated_at: "",
      });
    }
  }, [financialSummary, selectedSupplier]);

  const enteredAmount = watch("amount") || 0;
  const currentDue = financialSummary?.current_due ?? selectedSupplier?.current_balance ?? 0;

  const handleSelectSupplier = (supp: SupplierItem) => {
    setSelectedSupplier(supp);
    setSelectedSupplierId(supp.id);
    setValue("supplier_id", supp.id, { shouldValidate: true });
    clearErrors("supplier_id");
    setOpenSupplierPopover(false);
    setSupplierSearch("");
  };

  const handleClearSupplier = () => {
    setSelectedSupplier(null);
    setSelectedSupplierId("");
    setValue("supplier_id", "");
  };

  const handleFormSubmit = async (values: SupplierPaymentFormValues) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 w-full max-w-full">
      {/* 1. Supplier Selection */}
      <Card className="glass-card w-full max-w-full">
        <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <span>Supplier Selection</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Search supplier by Company Name, Phone, or Supplier Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-2">
          <div className="space-y-1.5 w-full">
            <Popover open={openSupplierPopover} onOpenChange={setOpenSupplierPopover}>
              <PopoverTrigger asChild>
                {selectedSupplier ? (
                  <div
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between gap-2 text-xs sm:text-sm w-full transition-colors",
                      initialData
                        ? "bg-muted/40 border-border cursor-not-allowed"
                        : "bg-primary/10 border-primary/20 hover:bg-primary/15 cursor-pointer"
                    )}
                    onClick={() => {
                      if (!initialData) {
                        setOpenSupplierPopover(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <UserCheck className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-bold text-foreground truncate">
                        {selectedSupplier.name} ({selectedSupplier.phone && selectedSupplier.phone.trim() ? selectedSupplier.phone.trim() : "No Phone"})
                      </span>
                      {selectedSupplier.supplier_code && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono">
                          {selectedSupplier.supplier_code}
                        </Badge>
                      )}
                    </div>
                    {!initialData && (
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearSupplier();
                          }}
                          className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                          title="Clear selection"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSupplierPopover}
                    className="w-full justify-between h-10 text-xs sm:text-sm font-normal bg-background/50 border-input hover:bg-accent/50"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground truncate">
                      <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-70" />
                      Select or search supplier (Name, Phone, Code)...
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                )}
              </PopoverTrigger>
              {!initialData && (
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-2rem)] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by supplier name, code, or phone..."
                      value={supplierSearch}
                      onValueChange={setSupplierSearch}
                    />
                    <CommandList className="max-h-60 overflow-y-auto">
                      {isSearchingSuppliers ? (
                        <div className="py-6 text-center text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          Searching suppliers...
                        </div>
                      ) : searchedSuppliers.length === 0 ? (
                        <CommandEmpty className="py-6 text-center text-xs sm:text-sm text-muted-foreground">
                          No suppliers found.
                        </CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {searchedSuppliers.map((supp) => {
                            const phoneText =
                              supp.phone && supp.phone.trim() ? supp.phone.trim() : "No Phone";
                            return (
                              <CommandItem
                                key={supp.id}
                                value={`${supp.name} ${supp.supplier_code || ""} ${supp.phone || ""} ${supp.id}`}
                                onSelect={() => handleSelectSupplier(supp)}
                                className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs sm:text-sm flex items-center justify-between gap-2 min-h-[44px]"
                              >
                                <span className="font-medium text-foreground truncate min-w-0">
                                  {supp.name} ({phoneText})
                                </span>
                                {supp.supplier_code && (
                                  <span className="text-[11px] text-muted-foreground font-mono shrink-0 ml-2">
                                    {supp.supplier_code}
                                  </span>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              )}
            </Popover>

            {errors.supplier_id && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium pt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.supplier_id.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Payment Entry & Details Card */}
      <Card className="glass-card w-full max-w-full">
        <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 shrink-0" />
            <span>3. Payment Entry & Details</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Enter payment amount, payment method, and transaction details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {/* Integrated Compact Current Due */}
          <div
            className={cn(
              "py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-lg border flex items-center justify-between gap-3 transition-colors",
              selectedSupplierId
                ? currentDue > 0
                  ? "bg-amber-500/5 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30"
                  : currentDue < 0
                  ? "bg-blue-500/5 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30"
                  : "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                : "bg-muted/30 border-border/60"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle
                className={cn(
                  "h-4 w-4 shrink-0",
                  selectedSupplierId
                    ? currentDue > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : currentDue < 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-xs sm:text-sm font-semibold text-foreground">Current Due</span>
            </div>

            {isSummaryLoading && !selectedSupplier ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <div className="text-right leading-tight">
                <span className="text-sm sm:text-base font-bold text-foreground block">
                  {selectedSupplierId
                    ? currentDue < 0
                      ? `-${formatCurrency(Math.abs(currentDue))}`
                      : formatCurrency(currentDue)
                    : formatCurrency(0)}
                </span>
                {selectedSupplierId && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold block",
                      currentDue > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : currentDue < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {currentDue > 0
                      ? "Outstanding Due"
                      : currentDue < 0
                      ? "Advance Balance"
                      : "Settled (No Due)"}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <label htmlFor="amount" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Payment Amount *
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
                className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 h-10"
              />
              {errors.amount && (
                <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {errors.amount.message}
                </p>
              )}
              {enteredAmount > 0 && selectedSupplierId && (
                <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                  <span>Remaining due after payment:</span>
                  <strong
                    className={cn(
                      "font-bold",
                      currentDue - enteredAmount <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground"
                    )}
                  >
                    {currentDue - enteredAmount <= 0
                      ? currentDue - enteredAmount < 0
                        ? `${formatCurrency(Math.abs(currentDue - enteredAmount))} (Advance)`
                        : "৳ 0.00 (Fully Paid)"
                      : formatCurrency(currentDue - enteredAmount)}
                  </strong>
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label htmlFor="payment_method" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                Payment Method *
              </label>
              <select
                id="payment_method"
                {...register("payment_method")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                Payment Date *
              </label>
              <Input
                id="payment_date"
                type="datetime-local"
                {...register("payment_date")}
                className="h-10 text-xs sm:text-sm"
              />
              {errors.payment_date && (
                <p className="text-xs text-destructive">{errors.payment_date.message}</p>
              )}
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <label htmlFor="reference_no" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                Reference Number (Optional)
              </label>
              <Input
                id="reference_no"
                type="text"
                placeholder="Bank TRX ID, Cheque #, Receipt #"
                {...register("reference_no")}
                className="h-10 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-1">
            <label htmlFor="notes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              Notes / Remarks
            </label>
            <textarea
              id="notes"
              rows={2}
              placeholder="Payment voucher description..."
              {...register("notes")}
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex flex-col sm:flex-row sm:justify-end gap-3 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !selectedSupplierId}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-6 font-semibold min-h-[44px]"
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
    </form>
  );
}
