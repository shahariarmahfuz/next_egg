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
  Hash,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { customerService, collectionService } from "@/services/api";
import { CustomerItem, CustomerFinancialSummary, CustomerCollectionItem } from "@/types";
import { formatCurrency } from "./collection-export-utils";

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialData?.customer_id || "");

  // Debounce customer search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(handler);
  }, [customerSearch]);

  // Fetch customer list for searching
  const { data: customerSearchData, isLoading: isSearchingCustomers } = useQuery({
    queryKey: ["customers-search-select", debouncedSearch],
    queryFn: () => customerService.getCustomers({ search: debouncedSearch || undefined, size: 20 }),
  });

  const searchedCustomers: CustomerItem[] = customerSearchData?.data?.items || [];

  // Fetch financial summary of selected customer
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["customer-financial-summary", selectedCustomerId],
    queryFn: () => collectionService.getCustomerSummary(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  const financialSummary: CustomerFinancialSummary | undefined = summaryData?.data;

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || "",
      collection_date: initialData?.collection_date
        ? new Date(initialData.collection_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      amount: initialData?.amount || 0,
      payment_method: initialData?.payment_method || "cash",
      reference_no: initialData?.reference_no || "",
      sale_id: initialData?.sale_id || "",
      notes: initialData?.notes || "",
    },
  });

  const watchedAmount = watch("amount");
  const currentDueAvailable = financialSummary?.current_due ?? (initialData?.customer?.current_balance || 0);
  const maxAllowedAmount = initialData ? currentDueAvailable + initialData.amount : currentDueAvailable;

  // Dynamic validation against current due
  useEffect(() => {
    if (selectedCustomerId && financialSummary) {
      if (watchedAmount > maxAllowedAmount) {
        setError("amount", {
          type: "manual",
          message: `Amount cannot exceed current due (${formatCurrency(maxAllowedAmount)})`,
        });
      } else if (watchedAmount <= 0) {
        setError("amount", {
          type: "manual",
          message: "Collection amount must be greater than zero",
        });
      } else {
        clearErrors("amount");
      }
    }
  }, [watchedAmount, financialSummary, maxAllowedAmount, selectedCustomerId, setError, clearErrors]);

  const handleSelectCustomer = (cust: CustomerItem) => {
    setSelectedCustomerId(cust.id);
    setValue("customer_id", cust.id, { shouldValidate: true });
  };

  const handleFormSubmit = async (values: CollectionFormValues) => {
    if (financialSummary && values.amount > maxAllowedAmount) {
      setError("amount", {
        type: "manual",
        message: `Amount cannot exceed current due (${formatCurrency(maxAllowedAmount)})`,
      });
      return;
    }
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Customer Search & Selection */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            1. Select Customer
          </CardTitle>
          <CardDescription>
            Search customer by Name, Phone, or Customer Code to fetch real-time due status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initialData && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search customer by name, phone, code (CUST-00001)..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9 pr-4 py-2"
              />
            </div>
          )}

          {/* Customer Suggestions List */}
          {!initialData && !selectedCustomerId && (
            <div className="border rounded-xl max-h-48 overflow-y-auto divide-y bg-card/60 backdrop-blur">
              {isSearchingCustomers ? (
                <div className="p-4 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching customer directory...
                </div>
              ) : searchedCustomers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No active customer found matching "{customerSearch}"
                </div>
              ) : (
                searchedCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className="w-full text-left p-3 hover:bg-accent/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                        <span>{cust.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {cust.customer_code}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {cust.phone}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-muted-foreground">Current Due</div>
                      <div className="text-sm font-bold text-amber-500">
                        {formatCurrency(cust.current_balance)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Customer Header Banner */}
          {selectedCustomerId && (
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-base">
                    {financialSummary?.name || initialData?.customer?.name}
                  </div>
                </div>
              </div>

              {!initialData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setValue("customer_id", "", { shouldValidate: true });
                  }}
                >
                  Change Customer
                </Button>
              )}
            </div>
          )}

          {errors.customer_id && (
            <p className="text-xs text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.customer_id.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Real-Time Customer Financial Summary Metrics Cards */}
      {selectedCustomerId && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Customer Financial Dues Summary
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <span className="text-xs text-amber-600 font-semibold block mb-1">Current Due</span>
                {isSummaryLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span className="text-2xl font-extrabold text-amber-500 ">
                    {formatCurrency(financialSummary?.current_due)}
                  </span>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground font-semibold block mb-1">Total Sales</span>
                {isSummaryLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span className="text-2xl font-extrabold text-foreground ">
                    {formatCurrency(financialSummary?.total_sales)}
                  </span>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4">
                <span className="text-xs text-emerald-600 font-semibold block mb-1">Total Paid</span>
                {isSummaryLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span className="text-2xl font-extrabold text-emerald-500 ">
                    {formatCurrency(financialSummary?.total_paid)}
                  </span>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground font-semibold block mb-1">Remaining Due</span>
                {isSummaryLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span className="text-2xl font-extrabold text-foreground">
                    {formatCurrency(financialSummary?.remaining_due)}
                  </span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. Collection Voucher Details Form */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            2. Payment Collection Entry
          </CardTitle>
          <CardDescription>
            Record collection date, payment method, reference, and collection amount.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Collection Date */}
            <div className="space-y-2">
              <label htmlFor="collection_date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Collection Date *
              </label>
              <Input
                id="collection_date"
                type="datetime-local"
                {...register("collection_date")}
                className="w-full"
              />
              {errors.collection_date && (
                <p className="text-xs text-destructive">{errors.collection_date.message}</p>
              )}
            </div>

            {/* Collection Amount */}
            <div className="space-y-2">
              <label htmlFor="amount" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                Collection Amount ($) *
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
                className="w-full text-lg font-bold text-emerald-500"
              />
              {errors.amount && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                Payment Method *
              </label>
              <select
                {...register("payment_method")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

          {/* Notes (Optional) */}
          <div className="space-y-2 pt-2">
            <label htmlFor="notes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Notes & Remarks (Optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Additional comments or payment breakdown details..."
              {...register("notes")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId || !!errors.amount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-6 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Collection...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {initialData ? "Update Collection Voucher" : "Save Collection Voucher"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
