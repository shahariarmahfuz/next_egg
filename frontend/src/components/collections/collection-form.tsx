"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  CheckCircle2,
  Calendar,
  CreditCard,
  Loader2,
  UserCheck,
  ChevronsUpDown,
  AlertTriangle,
  AlertCircle,
  FileText,
  DollarSign
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { customerService, collectionService } from "@/services/api";
import { CustomerItem, CustomerFinancialSummary, CustomerCollectionItem } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

const collectionFormSchema = z.object({
  customer_id: z.string().min(1, "Customer selection is required"),
  collection_date: z.string().min(1, "Collection date is required"),
  amount: z
    .number({ invalid_type_error: "Collection amount must be a valid number" })
    .positive("Collection amount must be greater than zero"),
  payment_method: z.string().min(1, "Payment method is required"),
  reference_no: z.string().optional(),
  sale_id: z.string().optional(),
  notes: z.string().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

interface CollectionFormProps {
  initialData?: CustomerCollectionItem;
  onSubmit: (values: CollectionFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function CollectionForm({ initialData, onSubmit, isSubmitting }: CollectionFormProps) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(initialData?.customer || null);

  const debouncedCustomerQuery = useDebounce(customerSearch, 300);

  const { data: customerSearchData, isLoading: isCustomerLoading } = useQuery({
    queryKey: ["customers-search", debouncedCustomerQuery],
    queryFn: () => customerService.getCustomers({ search: debouncedCustomerQuery, size: 20 }),
  });
  
  const customerSuggestions: CustomerItem[] = customerSearchData?.data?.items || [];

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["customer-financial-summary", selectedCustomer?.id],
    queryFn: () => collectionService.getCustomerSummary(selectedCustomer!.id),
    enabled: !!selectedCustomer?.id,
  });

  const financialSummary: CustomerFinancialSummary | undefined = summaryData?.data;

  // For Edit modal, the date must be YYYY-MM-DD for type="date"
  const defaultDate = initialData?.collection_date 
    ? new Date(initialData.collection_date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitted },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || "",
      collection_date: defaultDate,
      amount: initialData?.amount || 0,
      payment_method: initialData?.payment_method || "cash",
      reference_no: initialData?.reference_no || "",
      sale_id: initialData?.sale_id || "",
      notes: initialData?.notes || (initialData as any)?.note || "",
    },
  });

  const watchedAmount = watch("amount") || 0;
  const currentBalance = financialSummary?.current_due ?? selectedCustomer?.current_balance ?? (initialData?.customer?.current_balance || 0);
  // Using signed balance: if currentBalance is positive, we collect up to that as due.
  // The new balance after collection will be: currentBalance - watchedAmount.
  // If resulting balance is negative, it represents an advance.
  const resultingBalance = currentBalance - watchedAmount;
  const advanceCreated = resultingBalance < 0 ? Math.abs(resultingBalance) : 0;

  useEffect(() => {
    // Clear all stale validation errors when customer changes
    if (selectedCustomer?.id) {
      clearErrors();
    }
  }, [selectedCustomer?.id, clearErrors]);

  const handleFormSubmit = async (values: CollectionFormValues) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 w-full max-w-full pb-4">

      {/* Collection Information Card (Mirrors Sales Information from sale-form.tsx) */}
      <Card className="glass-card w-full">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Collection Information
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Row 1: Customer Selection */}
          <div className="space-y-1.5 w-full">
            <label className="text-xs font-semibold text-foreground block">
              Customer Selection
            </label>
            <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
              <PopoverTrigger asChild>
                {selectedCustomer ? (
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs w-full transition-colors",
                    initialData ? "bg-muted/40 border-border cursor-not-allowed" : "bg-primary/10 border-primary/20 hover:bg-primary/15 cursor-pointer"
                  )} onClick={() => {
                    if (!initialData) {
                      setOpenCustomerPopover(true);
                    }
                  }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-bold text-foreground truncate">{selectedCustomer.name}</span>
                    </div>
                    {!initialData && <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCustomerPopover}
                    className="w-full justify-between h-10 text-xs font-normal bg-background/50 border-input hover:bg-accent/50"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground truncate">
                      <Search className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      Select or search customer (Name, Phone, Code)...
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                )}
              </PopoverTrigger>
              {!initialData && (
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by customer name, code, or phone..."
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList>
                      {isCustomerLoading ? (
                        <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Searching customers...
                        </div>
                      ) : customerSuggestions.length === 0 ? (
                        <CommandEmpty>No customers found.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {customerSuggestions.map((cust) => (
                            <CommandItem
                              key={cust.id}
                              value={`${cust.name} ${cust.customer_code || ""} ${cust.phone || ""} ${cust.id}`}
                              onSelect={() => {
                                setSelectedCustomer(cust);
                                setValue("customer_id", cust.id);
                                clearErrors();
                                setOpenCustomerPopover(false);
                                setCustomerSearch("");
                              }}
                              className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs"
                            >
                              <span className="font-medium text-foreground">
                                {cust.name}{cust.phone ? ` (${cust.phone})` : ""}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              )}
            </Popover>
            {errors.customer_id && (
              <p className="text-xs text-destructive">{errors.customer_id.message}</p>
            )}
          </div>

          {/* Row 2: Date, Contact Number, Address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Collection Date
              </label>
              <Input
                type="date"
                {...register("collection_date")}
                className="h-10 text-xs bg-background/50"
              />
              {errors.collection_date && (
                <p className="text-xs text-destructive">{errors.collection_date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">Contact Number</label>
              <Input
                readOnly
                value={selectedCustomer?.phone || ""}
                placeholder="N/A"
                className="h-10 text-xs bg-muted/40 text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">Customer Address</label>
              <Input
                readOnly
                value={selectedCustomer?.address || ""}
                placeholder="N/A"
                className="h-10 text-xs bg-muted/40 text-muted-foreground truncate"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details Card */}
      <Card className="glass-card w-full">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" /> Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Compact Current Balance Row */}
          <div
            className={cn(
              "py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-lg border flex items-center justify-between gap-3 transition-colors",
              selectedCustomer
                ? currentBalance > 0
                  ? "bg-amber-500/5 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30"
                  : currentBalance < 0
                  ? "bg-blue-500/5 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30"
                  : "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                : "bg-muted/30 border-border/60"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle
                className={cn(
                  "h-4 w-4 shrink-0",
                  selectedCustomer
                    ? currentBalance > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : currentBalance < 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-xs sm:text-sm font-semibold text-foreground">Current Balance</span>
            </div>

            {isSummaryLoading && !selectedCustomer ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <div className="text-right leading-tight">
                <span className="text-sm sm:text-base font-bold text-foreground block">
                  {selectedCustomer
                    ? currentBalance < 0
                      ? `-${formatCurrency(Math.abs(currentBalance))}`
                      : formatCurrency(currentBalance)
                    : formatCurrency(0)}
                </span>
                {selectedCustomer && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold block",
                      currentBalance > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : currentBalance < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {currentBalance > 0
                      ? "Due"
                      : currentBalance < 0
                      ? "Advance Balance"
                      : "Settled (No Due)"}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Collection Amount ($)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
                className="h-10 text-lg font-bold text-emerald-500 bg-background/50"
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
              {!errors.amount && advanceCreated > 0 && (
                <p className="text-xs text-blue-500 font-medium mt-1">
                  The resulting customer balance will be -{formatCurrency(advanceCreated)} (Advance).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" /> Payment Method
              </label>
              <select
                {...register("payment_method")}
                className="w-full h-10 rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="cash">Cash Payment</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque Payment</option>
                <option value="card">Debit / Credit Card</option>
                <option value="mobile_banking">Mobile Banking (bKash / Nagad / Rocket)</option>
              </select>
              {errors.payment_method && (
                <p className="text-xs text-destructive">{errors.payment_method.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Notes & Remarks (Optional)
            </label>
            <Input
              type="text"
              placeholder="Additional comments or payment breakdown details..."
              {...register("notes")}
              className="h-10 text-xs bg-background/50"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !selectedCustomer || !!errors.amount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-6 font-semibold h-9 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {initialData ? "Update Collection" : "Save Collection"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
