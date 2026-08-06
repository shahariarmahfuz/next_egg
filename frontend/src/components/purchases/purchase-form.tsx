"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  Search,
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
  UserCheck,
  Package,
  AlertTriangle,
  ChevronsUpDown,
} from "lucide-react";
import { productService, supplierService } from "@/services/api";
import { ProductItem, PurchaseItem, SupplierItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PurchaseFormValues {
  supplier_id: string;
  purchase_no?: string;
  invoice_no?: string;
  purchase_date?: string;
  discount_amount: number;
  tax_amount: number;
  paid_amount: number;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    discount: number;
  }[];
}

interface LineItemState {
  product: ProductItem;
  quantity: number;
  unit_price: number;
  total_price: number;
  error?: string;
}

interface PurchaseFormProps {
  initialData?: PurchaseItem;
  suppliers: SupplierItem[];
  products: ProductItem[];
  isEdit?: boolean;
  onSubmit: (values: PurchaseFormValues) => Promise<void>;
  onCancel: () => void;
}

export function PurchaseForm({
  initialData,
  suppliers = [],
  products = [],
  isEdit = false,
  onSubmit,
  onCancel,
}: PurchaseFormProps) {
  // Supplier Selection State
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(() => {
    if (initialData?.supplier) return initialData.supplier;
    if (initialData?.supplier_id) {
      return suppliers.find((s) => s.id === initialData.supplier_id) || null;
    }
    return suppliers[0] || null;
  });
  const [openSupplierPopover, setOpenSupplierPopover] = useState(false);

  // Form Fields State
  const [purchaseDate, setPurchaseDate] = useState<string>(() => {
    if (initialData?.purchase_date) {
      return new Date(initialData.purchase_date).toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [customInvoiceNo, setCustomInvoiceNo] = useState<string>(
    initialData?.invoice_no || ""
  );

  // Product Search State
  const [productSearch, setProductSearch] = useState("");
  const [openProductPopover, setOpenProductPopover] = useState(false);

  // Invoice Line Items State
  const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item) => {
        const prod = item.product || products.find((p) => p.id === item.product_id) || {
          id: item.product_id,
          name: "Unknown Product",
          product_code: "",
          category_id: "",
          unit: "pcs",
          opening_stock_unit_cost: item.unit_price,
          selling_price: item.unit_price,
          current_stock: 0,
          status: "active",
          created_at: "",
          updated_at: "",
        };
        const qty = item.quantity || 1;
        const price = item.unit_price || 0;
        return {
          product: prod as ProductItem,
          quantity: qty,
          unit_price: price,
          total_price: Number((qty * price).toFixed(2)),
        };
      });
    }
    return [];
  });

  // Financial Parameters State
  const [discountAmount, setDiscountAmount] = useState<number>(
    initialData?.discount_amount ?? 0
  );
  const [taxAmount, setTaxAmount] = useState<number>(
    initialData?.tax_amount ?? 0
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    initialData?.paid_amount ?? 0
  );
  const [notes, setNotes] = useState<string>(initialData?.notes || "");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedSupplierQuery = useDebounce(supplierSearch, 300);
  const debouncedProductQuery = useDebounce(productSearch, 300);

  // Fetch Suppliers Search
  const { data: supplierSearchData, isLoading: isSupplierLoading } = useQuery({
    queryKey: ["suppliers-search", debouncedSupplierQuery],
    queryFn: () => supplierService.getSuppliers({ search: debouncedSupplierQuery, size: 20 }),
  });

  // Fetch Products Search
  const { data: productSearchData, isLoading: isProductLoading } = useQuery({
    queryKey: ["products-search", debouncedProductQuery],
    queryFn: () => productService.getProducts({ search: debouncedProductQuery, status: "active", size: 20 }),
  });

  const supplierSuggestions: SupplierItem[] = supplierSearchData?.data?.items || suppliers;
  const productSuggestions: ProductItem[] = productSearchData?.data?.items || products;

  // Sync default selected supplier if suppliers list loads later
  useEffect(() => {
    if (!selectedSupplier && suppliers.length > 0) {
      setSelectedSupplier(suppliers[0]);
    }
  }, [suppliers, selectedSupplier]);

  // Line Item Calculations
  const calculateLineTotal = (qty: number, price: number) => {
    const total = qty * price;
    return total > 0 ? Number(total.toFixed(2)) : 0;
  };

  // Add Product to Purchase Line Items
  const handleSelectProduct = (product: ProductItem) => {
    const existingIndex = lineItems.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      const existing = lineItems[existingIndex];
      const newQty = existing.quantity + 1;
      const updated = [...lineItems];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        total_price: calculateLineTotal(newQty, existing.unit_price),
        error: undefined,
      };
      setLineItems(updated);
    } else {
      const unitPrice = product.opening_stock_unit_cost ?? 0;
      const newItem: LineItemState = {
        product,
        quantity: 1,
        unit_price: unitPrice,
        total_price: calculateLineTotal(1, unitPrice),
      };
      setLineItems([...lineItems, newItem]);
    }

    setProductSearch("");
    setOpenProductPopover(false);
    setErrorMsg(null);
  };

  // Update Line Item Values with 3-Way Synchronization
  const handleUpdateItem = (
    index: number,
    field: "quantity" | "unit_price" | "total_price",
    value: number
  ) => {
    const updated = [...lineItems];
    const item = { ...updated[index] };

    if (field === "quantity") {
      item.quantity = value;
      if (value <= 0) {
        item.error = "Quantity must be greater than zero";
      } else {
        item.error = undefined;
      }

      // Rule A: If Quantity changes: Unit Price stays the same. Total Price = Quantity * Unit Price
      if (value > 0) {
        item.total_price = Number((item.quantity * item.unit_price).toFixed(2));
      }
    } else if (field === "unit_price") {
      item.unit_price = value < 0 ? 0 : value;
      // Rule B: If Unit Price changes: Quantity stays the same. Total Price = Quantity * Unit Price
      if (item.quantity > 0) {
        item.total_price = Number((item.quantity * item.unit_price).toFixed(2));
      }
    } else if (field === "total_price") {
      item.total_price = value < 0 ? 0 : value;
      // Rule C: If Total Price changes manually: Quantity stays the same. Unit Price = Total Price / Quantity
      if (item.quantity > 0) {
        item.unit_price = item.total_price / item.quantity;
      } else {
        item.error = "Quantity must be greater than zero to set total price";
      }
    }

    updated[index] = item;
    setLineItems(updated);
  };

  // Remove Line Item
  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Real-time Summary Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + item.total_price, 0);
  const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);
  const remainingDue = Math.max(0, grandTotal - paidAmount);
  const projectedSupplierPayable = (selectedSupplier?.current_balance || 0) + remainingDue;

  // Form Submission Handler
  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!selectedSupplier) {
      setErrorMsg("Please select a supplier for this purchase order.");
      toast.error("Please select a supplier.");
      return;
    }

    if (lineItems.length === 0) {
      setErrorMsg("Please add at least one product item to the purchase order.");
      toast.error("Please add product items.");
      return;
    }

    const hasErrors = lineItems.some((item) => item.error || item.quantity <= 0);
    if (hasErrors) {
      setErrorMsg("Please resolve line item errors before submitting.");
      toast.error("Invalid line items found.");
      return;
    }

    const payloadValues: PurchaseFormValues = {
      supplier_id: selectedSupplier.id,
      purchase_no: isEdit ? initialData?.purchase_no : undefined,
      invoice_no: customInvoiceNo.trim() || undefined,
      purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      paid_amount: paidAmount,
      notes: notes.trim() || undefined,
      items: lineItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price.toFixed(4)),
        discount: 0,
      })),
    };

    try {
      setIsSubmitting(true);
      await onSubmit(payloadValues);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save purchase order.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full px-1">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            {isEdit ? `Edit Purchase Order (${initialData?.purchase_no || ""})` : "Add Purchase"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEdit
              ? "Modify purchase order items and recalculate inventory stock levels."
              : "Record incoming supplier merchandise and automatically update product inventory stock."}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-9">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to List
        </Button>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-in fade-in-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid Layout: Left Column (Span 2/3), Right Column (Span 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {/* Left Column */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-6 w-full">
          {/* Purchase Information Card */}
          <Card className="glass-card w-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" /> Purchase Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Row 1 (Full Width): Supplier Selection */}
              <div className="space-y-1.5 w-full">
                <label className="text-xs font-semibold text-foreground block">
                  Supplier Selection *
                </label>
                <Popover open={openSupplierPopover} onOpenChange={setOpenSupplierPopover}>
                  <PopoverTrigger asChild>
                    {selectedSupplier ? (
                      /* Clickable supplier box - Single line name display */
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserCheck className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-bold text-foreground truncate">{selectedSupplier.name}</span>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openSupplierPopover}
                        className="w-full justify-between h-10 text-xs font-normal bg-background/50 border-input hover:bg-accent/50"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground truncate">
                          <Search className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          Select or search supplier (Name, Phone, Code)...
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    )}
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by supplier name, code, or phone..."
                        value={supplierSearch}
                        onValueChange={setSupplierSearch}
                      />
                      <CommandList>
                        {isSupplierLoading ? (
                          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Searching suppliers...
                          </div>
                        ) : supplierSuggestions.length === 0 ? (
                          <CommandEmpty>No suppliers found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {supplierSuggestions.map((sup) => (
                              <CommandItem
                                key={sup.id}
                                value={`${sup.name} ${sup.supplier_code || ""} ${sup.phone || ""} ${sup.id}`}
                                onSelect={() => {
                                  setSelectedSupplier(sup);
                                  setOpenSupplierPopover(false);
                                  setSupplierSearch("");
                                }}
                                className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs"
                              >
                                <span className="font-medium text-foreground">
                                  {sup.name}{sup.phone ? ` (${sup.phone})` : ""}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Row 2: Purchase Date, Contact Number, Supplier Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Purchase Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Purchase Date
                  </label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="h-10 text-xs bg-background/50"
                  />
                </div>

                {/* Contact Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Contact Number
                  </label>
                  <Input
                    readOnly
                    value={selectedSupplier?.phone || ""}
                    placeholder="N/A"
                    className="h-10 text-xs bg-muted/40 text-muted-foreground"
                  />
                </div>

                {/* Supplier Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Supplier Address
                  </label>
                  <Input
                    readOnly
                    value={selectedSupplier?.address || ""}
                    placeholder="N/A"
                    className="h-10 text-xs bg-muted/40 text-muted-foreground truncate"
                  />
                </div>
              </div>

              {/* Row 3: Supplier Code, Supplier Invoice Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Supplier Code
                  </label>
                  <Input
                    readOnly
                    value={selectedSupplier?.supplier_code || ""}
                    placeholder="N/A"
                    className="h-10 text-xs bg-muted/40 text-muted-foreground"
                  />
                </div>

                {/* Supplier Invoice Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Supplier Invoice Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <Input
                    type="text"
                    value={customInvoiceNo}
                    onChange={(e) => setCustomInvoiceNo(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="h-10 text-xs bg-background/50"
                  />
                </div>
              </div>

              {/* Row 4: Single-line Product Search & Add */}
              <div className="space-y-1.5 pt-2 border-t w-full">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" /> Product Search & Add to Purchase Order
                </label>
                <Popover open={openProductPopover} onOpenChange={setOpenProductPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openProductPopover}
                      className="w-full justify-between h-10 text-xs font-normal bg-background/50 border-input hover:bg-accent/50"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground truncate">
                        <Search className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        Scan barcode or search product (Name, Code, Barcode)...
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search product by name, code, or barcode..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        {isProductLoading ? (
                          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Searching products...
                          </div>
                        ) : productSuggestions.length === 0 ? (
                          <CommandEmpty>No products found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {productSuggestions.map((prod) => {
                              const formattedLabel = `${prod.name}${prod.product_code ? ` (${prod.product_code})` : ""}`;

                              return (
                                <CommandItem
                                  key={prod.id}
                                  value={`${prod.name} ${prod.product_code || ""} ${prod.barcode || ""} ${prod.id}`}
                                  onSelect={() => handleSelectProduct(prod)}
                                  className="py-2.5 px-3 border-b last:border-b-0 hover:bg-accent/70 cursor-pointer text-xs truncate"
                                >
                                  {/* Single line display: Product Name (Product Code) */}
                                  <div className="truncate text-xs font-medium text-foreground w-full" title={formattedLabel}>
                                    {formattedLabel}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Line Items Table Card */}
          <Card className="glass-card overflow-hidden w-full">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold">Purchase Items ({lineItems.length})</CardTitle>
                {lineItems.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setLineItems([])} className="text-xs text-destructive hover:bg-destructive/10">
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Item Description</th>
                    <th className="px-3.5 py-2.5 w-24">Quantity</th>
                    <th className="px-3.5 py-2.5 w-28">Unit Price</th>
                    <th className="px-3.5 py-2.5 w-28 text-right">Total Price</th>
                    <th className="px-3.5 py-2.5 w-12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No items added to purchase order yet. Search and select products above to populate order.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={`${item.product.id}-${idx}`} className="hover:bg-accent/40 transition-colors">
                        <td className="px-3.5 py-3 align-top">
                          <div className="font-bold text-foreground">{item.product.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Code: {item.product.product_code || "N/A"} | Current Stock: {item.product.current_stock} {item.product.unit || "pcs"}
                          </div>
                          {item.error && (
                            <div className="text-[10px] font-bold text-destructive mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {item.error}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                            className="h-8 text-xs font-bold w-20"
                          />
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={Number(item.unit_price.toFixed(4))}
                            onChange={(e) => handleUpdateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs font-bold w-24"
                          />
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.total_price}
                            onChange={(e) => handleUpdateItem(idx, "total_price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs font-bold w-24 text-right"
                          />
                        </td>
                        <td className="px-3.5 py-3 align-top text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Purchase Summary Card */}
        <div className="space-y-6 lg:col-span-1 w-full">
          <Card className="glass-card sticky top-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Purchase Summary</span>
                <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                  Stock Entry
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              {/* Financial Calculation Breakdown */}
              <div className="space-y-2 border-b pb-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Overall Discount ($):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-bold w-28 text-right"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tax Amount ($):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-bold w-28 text-right"
                  />
                </div>

                <div className="flex justify-between pt-2 text-sm font-extrabold border-t text-foreground">
                  <span>Grand Total:</span>
                  <span className="text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Payment Input */}
              <div className="space-y-3 border-b pb-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Paid Amount ($):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm font-extrabold w-32 text-right text-emerald-500"
                  />
                </div>

                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Outstanding Payable:</span>
                  <span className={remainingDue > 0 ? "text-amber-500 font-bold" : "text-emerald-500"}>
                    {formatCurrency(remainingDue)}
                  </span>
                </div>
              </div>

              {/* Supplier Account Impact */}
              {selectedSupplier && (
                <div className="p-3 rounded-xl bg-accent/40 border space-y-1 text-[11px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Existing Balance:</span>
                    <span>{formatCurrency(selectedSupplier.current_balance)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                    <span>New Account Payable:</span>
                    <span className={projectedSupplierPayable > 0 ? "text-amber-500" : "text-emerald-500"}>
                      {formatCurrency(projectedSupplierPayable)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Order Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter shipping tracking, delivery terms, or payment notes..."
                  className="w-full rounded-md border border-input bg-background/50 p-2 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-10 text-xs font-bold"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isEdit ? "Update Purchase Order" : "Save Purchase Order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
