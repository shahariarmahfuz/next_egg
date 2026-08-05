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
  ShoppingBag,
  RotateCcw,
  CheckSquare,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { purchaseService, productReturnService } from "@/services/api";
import { PurchaseItem, PurchaseReturnableSummary, ProductReturnItem } from "@/types";
import { formatCurrency, formatDate } from "./product-return-export-utils";

const returnItemSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string(),
  product_code: z.string(),
  unit: z.string(),
  purchased_quantity: z.number(),
  previously_returned_qty: z.number(),
  returnable_qty: z.number(),
  unit_price: z.number(),
  selected: z.boolean(),
  return_qty: z.number().min(0),
  notes: z.string().optional(),
});

const productReturnFormSchema = z.object({
  purchase_id: z.string().optional(),
  supplier_id: z.string().min(1, "Supplier selection is required"),
  return_date: z.string().min(1, "Return date is required"),
  refund_received: z.number().min(0, "Refund received cannot be negative"),
  reason: z.string().optional(),
  items: z.array(returnItemSchema).refine(
    (items) => items.some((i) => i.selected && i.return_qty > 0),
    "At least one item must be selected for return with a quantity greater than zero"
  ),
});

export type ProductReturnFormValues = z.infer<typeof productReturnFormSchema>;

interface ProductReturnFormProps {
  initialData?: ProductReturnItem;
  onSubmit: (values: ProductReturnFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function ProductReturnForm({ initialData, onSubmit, isSubmitting }: ProductReturnFormProps) {
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>(initialData?.purchase_id || "");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(purchaseSearch), 300);
    return () => clearTimeout(handler);
  }, [purchaseSearch]);

  // Query Purchases for selection
  const { data: purchasesSearchData, isLoading: isSearchingPurchases } = useQuery({
    queryKey: ["purchases-search-select", debouncedSearch],
    queryFn: () => purchaseService.getPurchases({ search: debouncedSearch || undefined, size: 20 }),
  });

  const searchedPurchases: PurchaseItem[] = purchasesSearchData?.data?.items || [];

  // Query Returnable Info for selected purchase
  const { data: returnableData, isLoading: isReturnableLoading } = useQuery({
    queryKey: ["purchase-returnable-info", selectedPurchaseId],
    queryFn: () => productReturnService.getReturnableInfo(selectedPurchaseId),
    enabled: !!selectedPurchaseId,
  });

  const purchaseSummary: PurchaseReturnableSummary | undefined = returnableData?.data;

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    setError,
    formState: { errors },
  } = useForm<ProductReturnFormValues>({
    resolver: zodResolver(productReturnFormSchema),
    defaultValues: {
      purchase_id: initialData?.purchase_id || "",
      supplier_id: initialData?.supplier_id || "",
      return_date: initialData?.return_date
        ? new Date(initialData.return_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      refund_received: initialData?.refund_received || 0,
      reason: initialData?.reason || "",
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "items",
  });

  // Populate items when returnable summary is fetched
  useEffect(() => {
    if (purchaseSummary) {
      setValue("supplier_id", purchaseSummary.supplier_id);
      setValue("purchase_id", purchaseSummary.purchase_id);

      const formItems = purchaseSummary.items.map((item) => {
        const existingInInitial = initialData?.items?.find((i) => i.product_id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          unit: item.unit,
          purchased_quantity: item.purchased_quantity,
          previously_returned_qty: item.previously_returned_qty,
          returnable_qty: item.returnable_qty + (existingInInitial?.quantity || 0),
          unit_price: item.unit_price,
          selected: !!existingInInitial,
          return_qty: existingInInitial?.quantity || 0,
          notes: "",
        };
      });

      replace(formItems);
    }
  }, [purchaseSummary, replace, setValue, initialData]);

  const watchedItems = watch("items") || [];
  const watchedRefund = watch("refund_received") || 0;

  const calculatedReturnTotal = watchedItems.reduce((sum, item) => {
    if (item.selected && item.return_qty > 0) {
      return sum + item.return_qty * item.unit_price;
    }
    return sum;
  }, 0);

  const netSupplierDebtReduction = Math.max(0, calculatedReturnTotal - watchedRefund);

  const handleSelectPurchase = (purch: PurchaseItem) => {
    setSelectedPurchaseId(purch.id);
  };

  const handleFormSubmit = async (values: ProductReturnFormValues) => {
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
        message: "Please select at least one product to return with a quantity > 0",
      });
      return;
    }

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Search & Select Original Purchase Order */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            1. Search & Select Original Purchase Order
          </CardTitle>
          <CardDescription>
            Search by Purchase Number (PO-00001), Invoice Number, Supplier Name, Phone, or Supplier Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initialData && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search PO # (PO-00001), supplier name, phone..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className="pl-9 pr-4 py-2"
              />
            </div>
          )}

          {/* Search Results List */}
          {!initialData && !selectedPurchaseId && (
            <div className="border rounded-xl max-h-48 overflow-y-auto divide-y bg-card/60 backdrop-blur">
              {isSearchingPurchases ? (
                <div className="p-4 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching purchase orders...
                </div>
              ) : searchedPurchases.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No purchase order found matching "{purchaseSearch}"
                </div>
              ) : (
                searchedPurchases.map((purch) => (
                  <button
                    key={purch.id}
                    type="button"
                    onClick={() => handleSelectPurchase(purch)}
                    className="w-full text-left p-3 hover:bg-accent/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                        <span className="text-primary font-bold">{purch.purchase_no}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {formatDate(purch.purchase_date)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="h-3 w-3" /> {purch.supplier?.name || "Supplier"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {purch.supplier?.phone}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-muted-foreground font-semibold">PO Total</div>
                      <div className="text-sm font-bold text-foreground">
                        {formatCurrency(purch.grand_total)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Purchase Banner */}
          {selectedPurchaseId && (
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <span className="text-primary">{purchaseSummary?.purchase_no || initialData?.purchase?.purchase_no}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      • {purchaseSummary?.supplier_name || initialData?.supplier?.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span>PO Grand Total: <strong className="text-foreground">{formatCurrency(purchaseSummary?.grand_total || initialData?.purchase?.grand_total)}</strong></span>
                    <span>Supplier Outstanding Due: <strong className="text-blue-500">{formatCurrency(purchaseSummary?.due_amount || initialData?.purchase?.due_amount)}</strong></span>
                  </div>
                </div>
              </div>

              {!initialData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPurchaseId("");
                    setValue("purchase_id", "");
                    setValue("supplier_id", "");
                  }}
                >
                  Change Purchase
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

      {/* 2. Select Products & Specify Return Quantities & Costs */}
      {selectedPurchaseId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              2. Select Purchased Products & Quantities to Return
            </CardTitle>
            <CardDescription>
              Select products to return back to supplier. Returned quantity cannot exceed returnable quantity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isReturnableLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex justify-center items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading purchase line items...
              </div>
            ) : fields.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No returnable products found for this purchase order.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                      <th className="p-3 text-center">Select</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Purchased Qty</th>
                      <th className="p-3 text-center">Prev Returned</th>
                      <th className="p-3 text-center">Returnable Qty</th>
                      <th className="p-3 text-right">Return Price ($)</th>
                      <th className="p-3 text-center w-32">Return Qty</th>
                      <th className="p-3 text-right">Return Total ($)</th>
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
                          className={`transition-colors ${isSelected ? "bg-blue-500/5 font-semibold" : "hover:bg-accent/40"}`}
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
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-foreground">{field.product_name}</div>
                            <div className="text-[10px] text-muted-foreground ">{field.product_code}</div>
                          </td>

                          <td className="p-3 text-center ">{field.purchased_quantity} {field.unit}</td>
                          <td className="p-3 text-center text-muted-foreground">{field.previously_returned_qty} {field.unit}</td>
                          <td className="p-3 text-center font-bold text-emerald-500">{field.returnable_qty} {field.unit}</td>

                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!isSelected}
                              value={itemWatch.unit_price ?? field.unit_price}
                              onChange={(e) => {
                                const pVal = parseFloat(e.target.value) || 0;
                                setValue(`items.${idx}.unit_price`, pVal);
                              }}
                              className="w-24 text-right text-xs font-bold ml-auto"
                            />
                          </td>

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

                          <td className="p-3 text-right font-bold text-blue-500">
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

      {/* 3. Financial Summary & Refund Received */}
      {selectedPurchaseId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              3. Refund Received & Supplier Balance Adjustment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Goods Returned */}
              <div className="p-4 rounded-xl border bg-card/60">
                <span className="text-xs text-muted-foreground font-semibold block mb-1">
                  Total Product Return Value
                </span>
                <span className="text-2xl font-extrabold text-foreground ">
                  {formatCurrency(calculatedReturnTotal)}
                </span>
              </div>

              {/* Cash Refund Received */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <label htmlFor="refund_received" className="text-xs text-muted-foreground font-semibold block">
                  Cash Refund Received from Supplier ($)
                </label>
                <Input
                  id="refund_received"
                  type="number"
                  step="0.01"
                  min="0"
                  max={calculatedReturnTotal}
                  {...register("refund_received", { valueAsNumber: true })}
                  className="text-lg font-bold text-blue-500"
                />
                {errors.refund_received && (
                  <p className="text-[10px] text-destructive">{errors.refund_received.message}</p>
                )}
              </div>

              {/* Net Debt Reduction */}
              <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30">
                <span className="text-xs text-blue-600 font-semibold block mb-1">
                  Net Reduction in Supplier Due Balance
                </span>
                <span className="text-2xl font-extrabold text-blue-500 ">
                  {formatCurrency(netSupplierDebtReduction)}
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
                  placeholder="Damaged goods, expired stock, quality defect..."
                  {...register("reason")}
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button
                type="submit"
                disabled={isSubmitting || calculatedReturnTotal <= 0}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-6 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Product Return...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {initialData ? "Update Product Return Voucher" : "Save Product Return Voucher"}
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
