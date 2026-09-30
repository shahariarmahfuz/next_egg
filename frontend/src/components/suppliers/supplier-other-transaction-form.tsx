"use client";

import { useState } from "react";
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
  ChevronsUpDown,
  UserCheck,
  X,
  ArrowDownLeft,
  ShieldCheck,
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
import { SupplierItem, SupplierFinancialSummary } from "@/types";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const supplierOtherTransactionSchema = z.object({
  supplier_id: z.string().min(1, "Supplier selection is required"),
  transaction_type: z.literal("other_payable"),
  amount: z.number().gt(0, "Transaction amount must be greater than zero"),
  transaction_date: z.string().min(1, "Transaction date is required"),
  reference_no: z.string().optional(),
  notes: z.string().optional(),
});

export type SupplierOtherTransactionFormValues = z.infer<typeof supplierOtherTransactionSchema>;

interface SupplierOtherTransactionFormProps {
  onSubmit: (values: SupplierOtherTransactionFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function SupplierOtherTransactionForm({
  onSubmit,
  isSubmitting,
}: SupplierOtherTransactionFormProps) {
  const { user } = useAuth();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [openSupplierPopover, setOpenSupplierPopover] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);

  const debouncedSearch = useDebounce(supplierSearch, 300);

  // Query suppliers list
  const { data: suppliersSearchData, isLoading: isSearchingSuppliers } = useQuery({
    queryKey: ["suppliers-search-select-other", debouncedSearch],
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
  const currentDue = financialSummary?.current_due ?? selectedSupplier?.current_balance ?? 0;

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SupplierOtherTransactionFormValues>({
    resolver: zodResolver(supplierOtherTransactionSchema),
    defaultValues: {
      supplier_id: "",
      transaction_type: "other_payable",
      amount: undefined,
      transaction_date: new Date().toISOString().slice(0, 16),
      reference_no: "",
      notes: "",
    },
  });

  const enteredAmount = watch("amount") || 0;
  const newPayableDue = currentDue + (typeof enteredAmount === "number" && enteredAmount > 0 ? enteredAmount : 0);

  const handleSelectSupplier = (supp: SupplierItem) => {
    setSelectedSupplierId(supp.id);
    setSelectedSupplier(supp);
    setValue("supplier_id", supp.id, { shouldValidate: true });
    setOpenSupplierPopover(false);
  };

  const handleClearSupplier = () => {
    setSelectedSupplierId("");
    setSelectedSupplier(null);
    setValue("supplier_id", "", { shouldValidate: true });
  };

  const handleFormSubmit = async (values: SupplierOtherTransactionFormValues) => {
    await onSubmit(values);
    // Reset form after successful submission
    reset({
      supplier_id: "",
      transaction_type: "other_payable",
      amount: undefined,
      transaction_date: new Date().toISOString().slice(0, 16),
      reference_no: "",
      notes: "",
    });
    setSelectedSupplierId("");
    setSelectedSupplier(null);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 w-full max-w-full">
      {/* 1. Supplier Selection */}
      <Card className="glass-card w-full max-w-full">
        <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>1. Supplier Selection</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Search and select the supplier who provided the funds or loan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-2">
          <div className="space-y-1.5 w-full">
            <Popover open={openSupplierPopover} onOpenChange={setOpenSupplierPopover}>
              <PopoverTrigger asChild>
                {selectedSupplier ? (
                  <div
                    className="p-3 rounded-xl border flex items-center justify-between gap-2 text-xs sm:text-sm w-full transition-colors bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15 cursor-pointer"
                    onClick={() => setOpenSupplierPopover(true)}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-bold text-foreground truncate">
                        {selectedSupplier.name} ({selectedSupplier.phone && selectedSupplier.phone.trim() ? selectedSupplier.phone.trim() : "No Phone"})
                      </span>
                      {selectedSupplier.supplier_code && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono">
                          {selectedSupplier.supplier_code}
                        </Badge>
                      )}
                    </div>
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
                          const phoneText = supp.phone && supp.phone.trim() ? supp.phone.trim() : "No Phone";
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

      {/* 2. Transaction Details & Accounting Impact */}
      <Card className="glass-card w-full max-w-full">
        <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>2. Transaction Details & Ledger Impact</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Record money received from supplier outside normal purchases. Increases total payable due.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {/* Live Balance Impact Preview Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border bg-muted/30 border-border/70">
            {/* Current Due */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
                Current Payable Due
              </span>
              {isSummaryLoading && selectedSupplierId ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <span className="text-base sm:text-lg font-bold text-foreground block">
                  {selectedSupplierId ? formatCurrency(currentDue) : formatCurrency(0)}
                </span>
              )}
            </div>

            {/* Other Payable Amount */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide block">
                + Other Payable (Received)
              </span>
              <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 block">
                +{formatCurrency(typeof enteredAmount === "number" && enteredAmount > 0 ? enteredAmount : 0)}
              </span>
            </div>

            {/* New Payable Due */}
            <div className="space-y-1 sm:border-l sm:pl-3 border-border/70">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide block">
                = New Payable Due
              </span>
              <span className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 block">
                {formatCurrency(newPayableDue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Transaction Type */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Transaction Type
              </label>
              <div className="h-10 px-3 rounded-md border border-input bg-muted/40 flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-foreground">Other Payable</span>
                <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30">
                  Increases Balance
                </Badge>
              </div>
              <input type="hidden" {...register("transaction_type")} value="other_payable" />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Amount (৳) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="Enter amount (e.g. 10000)"
                {...register("amount", { valueAsNumber: true })}
                className={cn("h-10 text-xs sm:text-sm bg-background/50", errors.amount && "border-destructive")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Transaction Date */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Transaction Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                {...register("transaction_date")}
                className={cn("h-10 text-xs sm:text-sm bg-background/50", errors.transaction_date && "border-destructive")}
              />
              {errors.transaction_date && (
                <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.transaction_date.message}
                </p>
              )}
            </div>

            {/* Note / Reference */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Note / Reference (Optional)
              </label>
              <Input
                placeholder="e.g. Short-term cash loan, Bank Transfer Ref"
                {...register("reference_no")}
                className="h-10 text-xs sm:text-sm bg-background/50"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Notes / Description (Optional)
            </label>
            <Input
              placeholder="Provide extra details for this transaction ledger entry..."
              {...register("notes")}
              className="h-10 text-xs sm:text-sm bg-background/50"
            />
          </div>

          {/* Recorded By (Automatic) */}
          <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground font-medium">Recorded By:</span>
              <span className="font-bold text-foreground">
                {user?.full_name || user?.username || "Logged-in User"}
              </span>
            </div>
            {user?.role?.name && (
              <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                {user.role.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || !selectedSupplierId}
          className="h-10 px-6 font-semibold bg-blue-600 hover:bg-blue-700 text-white min-w-[180px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recording Transaction...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Record Other Payable
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
