"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
  Package,
  ShoppingCart,
  RotateCcw,
  CheckSquare,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { saleService, saleReturnService } from "@/services/api";
import { SaleItem, SaleReturnableSummary, SaleReturnItem } from "@/types";
import { formatCurrency, formatDate } from "./sale-return-export-utils";

const returnItemSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string(),
  product_code: z.string(),
  unit: z.string(),
  sold_quantity: z.number(),
  previously_returned_qty: z.number(),
  returnable_qty: z.number(),
  unit_price: z.number(),
  selected: z.boolean(),
  return_qty: z.number().min(0),
});

const saleReturnFormSchema = z.object({
  sale_id: z.string().optional(),
  customer_id: z.string().min(1, "Customer selection is required"),
  return_date: z.string().min(1, "Return date is required"),
  refund_amount: z.number().min(0, "Refund amount cannot be negative"),
  reason: z.string().optional(),
  items: z.array(returnItemSchema).refine(
    (items) => items.some((i) => i.selected && i.return_qty > 0),
    "At least one item must be selected for return with a quantity greater than zero"
  ),
});

export type SaleReturnFormValues = z.infer<typeof saleReturnFormSchema>;

interface SaleReturnFormProps {
  initialData?: SaleReturnItem;
  onSubmit: (values: SaleReturnFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function SaleReturnForm({ initialData, onSubmit, isSubmitting }: SaleReturnFormProps) {
  const [saleSearch, setSaleSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string>(initialData?.sale_id || "");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(saleSearch), 300);
    return () => clearTimeout(handler);
  }, [saleSearch]);

  // Query Sales list for selection
  const { data: salesSearchData, isLoading: isSearchingSales } = useQuery({
    queryKey: ["sales-search-select", debouncedSearch],
    queryFn: () => saleService.getSales({ search: debouncedSearch || undefined, size: 20 }),
  });

  const searchedSales: SaleItem[] = salesSearchData?.data?.items || [];

  // Query Returnable Info for selected sale
  const { data: returnableData, isLoading: isReturnableLoading } = useQuery({
    queryKey: ["sale-returnable-info", selectedSaleId],
    queryFn: () => saleReturnService.getReturnableInfo(selectedSaleId),
    enabled: !!selectedSaleId,
  });

  const saleSummary: SaleReturnableSummary | undefined = returnableData?.data;

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SaleReturnFormValues>({
    resolver: zodResolver(saleReturnFormSchema),
    defaultValues: {
      sale_id: initialData?.sale_id || "",
      customer_id: initialData?.customer_id || "",
      return_date: initialData?.return_date
        ? new Date(initialData.return_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      refund_amount: initialData?.refund_amount || 0,
      reason: initialData?.reason || "",
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "items",
  });

  // Populate line items when returnable info is loaded
  useEffect(() => {
    if (saleSummary) {
      setValue("customer_id", saleSummary.customer_id);
      setValue("sale_id", saleSummary.sale_id);

      const formItems = saleSummary.items.map((item) => {
        const existingInInitial = initialData?.items?.find((i) => i.product_id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          unit: item.unit,
          sold_quantity: item.sold_quantity,
          previously_returned_qty: item.previously_returned_qty,
          returnable_qty: item.returnable_qty + (existingInInitial?.quantity || 0),
          unit_price: item.unit_price,
          selected: !!existingInInitial,
          return_qty: existingInInitial?.quantity || 0,
        };
      });

      replace(formItems);
    }
  }, [saleSummary, replace, setValue, initialData]);

  const watchedItems = watch("items") || [];
  const watchedRefund = watch("refund_amount") || 0;

  // Calculate return grand total
  const calculatedReturnTotal = watchedItems.reduce((sum, item) => {
    if (item.selected && item.return_qty > 0) {
      return sum + item.return_qty * item.unit_price;
    }
    return sum;
  }, 0);

  const netCreditToDue = Math.max(0, calculatedReturnTotal - watchedRefund);

  const handleSelectSale = (sale: SaleItem) => {
    setSelectedSaleId(sale.id);
  };

  const handleFormSubmit = async (values: SaleReturnFormValues) => {
    // Validate individual return quantities against returnable_qty
    let hasQtyError = false;
    values.items.forEach((item, index) => {
      if (item.selected && item.return_qty > item.returnable_qty) {
        hasQtyError = true;
        setError(`items.${index}.return_qty`, {
          type: "manual",
          message: `Cannot exceed returnable qty (${item.returnable_qty})`,
        });
      }
    });

    if (hasQtyError) return;
    if (calculatedReturnTotal <= 0) {
      setError("items", {
        type: "manual",
        message: "Please select at least one item to return with a quantity > 0",
      });
      return;
    }

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Search & Select Original Sale Invoice */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            1. Search & Select Original Sale Invoice
          </CardTitle>
          <CardDescription>
            Search by Invoice Number (SL-00001), Customer Name, Phone, or Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initialData && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search invoice # (SL-00001), customer name, phone..."
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                className="pl-9 pr-4 py-2"
              />
            </div>
          )}

          {/* Search Results List */}
          {!initialData && !selectedSaleId && (
            <div className="border rounded-xl max-h-48 overflow-y-auto divide-y bg-card/60 backdrop-blur">
              {isSearchingSales ? (
                <div className="p-4 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching sales directory...
                </div>
              ) : searchedSales.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No sales invoice found matching "{saleSearch}"
                </div>
              ) : (
                searchedSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => handleSelectSale(sale)}
                    className="w-full text-left p-3 hover:bg-accent/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                        <span className="text-primary font-bold">{sale.invoice_no}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {formatDate(sale.sale_date)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="h-3 w-3" /> {sale.customer?.name || "Customer"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {sale.customer?.phone}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-muted-foreground">Grand Total</div>
                      <div className="text-sm font-bold text-foreground">
                        {formatCurrency(sale.grand_total)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Sale Invoice Banner */}
          {selectedSaleId && (
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <span className="text-primary">{saleSummary?.invoice_no || initialData?.sale?.invoice_no}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      • {saleSummary?.customer_name || initialData?.customer?.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span>Invoice Total: <strong className="text-foreground">{formatCurrency(saleSummary?.grand_total || initialData?.sale?.grand_total)}</strong></span>
                    <span>Outstanding Due: <strong className="text-amber-500">{formatCurrency(saleSummary?.due_amount || initialData?.sale?.due_amount)}</strong></span>
                  </div>
                </div>
              </div>

              {!initialData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSaleId("");
                    setValue("sale_id", "");
                    setValue("customer_id", "");
                  }}
                >
                  Change Sale
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

      {/* 2. Select Products & Specify Returned Quantities */}
      {selectedSaleId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              2. Select Items & Quantities to Return
            </CardTitle>
            <CardDescription>
              Select items from the original invoice. Returned quantity cannot exceed returnable quantity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isReturnableLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex justify-center items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading invoice line items...
              </div>
            ) : fields.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No returnable products found for this sale.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                      <th className="p-3 text-center">Select</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Sold Qty</th>
                      <th className="p-3 text-center">Prev Returned</th>
                      <th className="p-3 text-center">Returnable Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-center w-32">Return Qty</th>
                      <th className="p-3 text-right">Return Amount ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.map((field, idx) => {
                      const itemWatch = watchedItems[idx] || {};
                      const isSelected = itemWatch.selected;
                      const returnQty = itemWatch.return_qty || 0;
                      const lineTotal = isSelected ? returnQty * field.unit_price : 0;

                      return (
                        <tr
                          key={field.id}
                          className={`transition-colors ${isSelected ? "bg-amber-500/5 font-semibold" : "hover:bg-accent/40"}`}
                        >
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !isSelected;
                                setValue(`items.${idx}.selected`, nextVal);
                                if (nextVal && returnQty === 0) {
                                  setValue(`items.${idx}.return_qty`, Math.min(1, field.returnable_qty));
                                }
                              }}
                              className="text-primary hover:text-primary/80"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-amber-500" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-foreground">{field.product_name}</div>
                            <div className="text-[10px] text-muted-foreground ">{field.product_code}</div>
                          </td>

                          <td className="p-3 text-center ">{field.sold_quantity} {field.unit}</td>
                          <td className="p-3 text-center text-muted-foreground">{field.previously_returned_qty} {field.unit}</td>
                          <td className="p-3 text-center font-bold text-emerald-500">{field.returnable_qty} {field.unit}</td>
                          <td className="p-3 text-right ">{formatCurrency(field.unit_price)}</td>

                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max={field.returnable_qty}
                              disabled={!isSelected}
                              value={returnQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setValue(`items.${idx}.return_qty`, val);
                                if (val > 0 && !isSelected) {
                                  setValue(`items.${idx}.selected`, true);
                                }
                              }}
                              className="w-24 text-center text-xs font-bold"
                            />
                            {errors.items?.[idx]?.return_qty && (
                              <p className="text-[10px] text-destructive mt-0.5">
                                {errors.items[idx]?.return_qty?.message}
                              </p>
                            )}
                          </td>

                          <td className="p-3 text-right font-bold text-amber-500">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {errors.items && typeof errors.items.message === "string" && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium pt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.items.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Return Financial Summary & Refund Options */}
      {selectedSaleId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              3. Refund & Balance Adjustment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Goods Returned */}
              <div className="p-4 rounded-xl border bg-card/60">
                <span className="text-xs text-muted-foreground font-semibold block mb-1">
                  Total Goods Returned Value
                </span>
                <span className="text-2xl font-extrabold text-foreground ">
                  {formatCurrency(calculatedReturnTotal)}
                </span>
              </div>

              {/* Cash Refund Amount */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <label htmlFor="refund_amount" className="text-xs text-muted-foreground font-semibold block">
                  Cash Refund Paid to Customer ($)
                </label>
                <Input
                  id="refund_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={calculatedReturnTotal}
                  {...register("refund_amount", { valueAsNumber: true })}
                  className="text-lg font-bold text-amber-500"
                />
                {errors.refund_amount && (
                  <p className="text-[10px] text-destructive">{errors.refund_amount.message}</p>
                )}
              </div>

              {/* Net Credit to Customer Due */}
              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30">
                <span className="text-xs text-emerald-600 font-semibold block mb-1">
                  Net Credit Adjusted Against Due
                </span>
                <span className="text-2xl font-extrabold text-emerald-500 ">
                  {formatCurrency(netCreditToDue)}
                </span>
              </div>
            </div>

            {/* Date & Reason */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Return Date *
                </label>
                <Input type="datetime-local" {...register("return_date")} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Return Reason & Notes
                </label>
                <Input
                  type="text"
                  placeholder="Defective product, wrong size, customer requested return..."
                  {...register("reason")}
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button
                type="submit"
                disabled={isSubmitting || calculatedReturnTotal <= 0}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20 px-6 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Sale Return...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {initialData ? "Update Sale Return Voucher" : "Save Sale Return Voucher"}
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
