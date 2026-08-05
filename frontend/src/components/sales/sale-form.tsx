"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Save,
  Printer,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  DollarSign,
  UserCheck,
  User,
  Package,
  AlertTriangle,
  ChevronsUpDown,
  FileText,
} from "lucide-react";
import { customerService, productService, saleService } from "@/services/api";
import { CustomerItem, ProductItem, SaleCreatePayload } from "@/types";
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

interface LineItemState {
  product: ProductItem;
  quantity: number;
  unit_price: number;
  total_price: number;
  error?: string;
}

export function SaleForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Customer State
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isCashSale, setIsCashSale] = useState(false);
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);

  // Form Fields State
  const [saleDate, setSaleDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [customInvoiceNo, setCustomInvoiceNo] = useState<string>("");

  // Product Search State
  const [productSearch, setProductSearch] = useState("");
  const [openProductPopover, setOpenProductPopover] = useState(false);

  // Invoice Line Items State
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);

  // Header Financial Parameters
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedCustomerQuery = useDebounce(customerSearch, 300);
  const debouncedProductQuery = useDebounce(productSearch, 300);

  // Fetch Customers Search
  const { data: customerSearchData, isLoading: isCustomerLoading } = useQuery({
    queryKey: ["customers-search", debouncedCustomerQuery],
    queryFn: () => customerService.getCustomers({ search: debouncedCustomerQuery, size: 20 }),
    enabled: !isCashSale,
  });

  // Fetch Products Search
  const { data: productSearchData, isLoading: isProductLoading } = useQuery({
    queryKey: ["products-search", debouncedProductQuery],
    queryFn: () => productService.getProducts({ search: debouncedProductQuery, status: "active", size: 20 }),
    enabled: true,
  });

  const customerSuggestions: CustomerItem[] = customerSearchData?.data?.items || [];
  const productSuggestions: ProductItem[] = productSearchData?.data?.items || [];

  // Line Item Calculations: Total = Quantity * Unit Price
  const calculateLineTotal = (qty: number, price: number) => {
    const total = qty * price;
    return total > 0 ? total : 0;
  };

  // Add Product to Invoice
  const handleSelectProduct = (product: ProductItem) => {
    const existingIndex = lineItems.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      const existing = lineItems[existingIndex];
      const newQty = existing.quantity + 1;

      if (newQty > product.current_stock) {
        setErrorMsg(`Cannot add more "${product.name}". Maximum available stock is ${product.current_stock} ${product.unit}.`);
        return;
      }

      const updated = [...lineItems];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        total_price: calculateLineTotal(newQty, existing.unit_price),
        error: undefined,
      };
      setLineItems(updated);
    } else {
      if (product.current_stock <= 0) {
        setErrorMsg(`Product "${product.name}" is currently OUT OF STOCK.`);
        return;
      }

      const newItem: LineItemState = {
        product,
        quantity: 1,
        unit_price: product.selling_price,
        total_price: calculateLineTotal(1, product.selling_price),
      };
      setLineItems([...lineItems, newItem]);
    }

    setProductSearch("");
    setOpenProductPopover(false);
    setErrorMsg(null);
  };

  // Update Line Item Values
  const handleUpdateItem = (
    index: number,
    field: "quantity" | "unit_price" | "total_price",
    value: number
  ) => {
    const updated = [...lineItems];
    const item = { ...updated[index] };

    if (field === "quantity") {
      item.quantity = value;
      if (value > item.product.current_stock) {
        item.error = `Exceeds available stock (${item.product.current_stock} ${item.product.unit})`;
      } else if (value <= 0) {
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
  const grandTotal = Math.max(0, subtotal - orderDiscount + taxAmount);
  const dueAmount = Math.max(0, grandTotal - paidAmount);

  const projectedCustomerDue = (selectedCustomer?.current_balance || 0) + dueAmount;

  // Form Submit Handler
  const createSaleMutation = useMutation({
    mutationFn: (payload: SaleCreatePayload) => saleService.createSale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const handleSubmit = async (andPrint: boolean = false) => {
    setErrorMsg(null);

    // Validations
    if (!isCashSale && !selectedCustomer) {
      setErrorMsg("Please select a registered customer or enable Cash / Walk-in sale mode.");
      return;
    }

    if (lineItems.length === 0) {
      setErrorMsg("Cannot submit empty sales invoice. Please add at least one product.");
      return;
    }

    const hasErrors = lineItems.some((item) => item.error !== undefined);
    if (hasErrors) {
      setErrorMsg("Please fix stock validation errors on invoice items before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: SaleCreatePayload = {
        customer_id: selectedCustomer?.id || "",
        invoice_no: customInvoiceNo.trim() || undefined,
        sale_date: saleDate ? new Date(saleDate).toISOString() : new Date().toISOString(),
        items: lineItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: 0,
        })),
        discount_amount: orderDiscount,
        tax_amount: taxAmount,
        paid_amount: paidAmount,
        notes: notes.trim() || undefined,
      };

      const res = await createSaleMutation.mutateAsync(payload);
      toast.success("Sales invoice created successfully.");

      if (andPrint && res?.data?.id) {
        router.push(`/sales/${res.data.id}/print`);
      } else {
        router.push("/sales");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to process sale order.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full w-full pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            New Sales Order (POS)
          </h1>
          <p className="text-xs text-muted-foreground">
            Process sales transactions and issue invoices. Stock decreases automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/sales")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Left = Unified Sales Information & Items (Expanded), Right = Order Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {/* Left Column (Span 2 on LG, Span 3 on XL) */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-6 w-full">
          {/* Unified "Sales Information" Card */}
          <Card className="glass-card w-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" /> Sales Information
                </span>
                <Button
                  variant={isCashSale ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    setIsCashSale(!isCashSale);
                    setSelectedCustomer(null);
                    setCustomerSearch("");
                    setOpenCustomerPopover(false);
                  }}
                >
                  <DollarSign className="mr-1 h-3.5 w-3.5" />
                  {isCashSale ? "Cash Sale Selected" : "Cash / Walk-in Sale"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Row 1 (Full Width): Customer Selection */}
              <div className="space-y-1.5 w-full">
                <label className="text-xs font-semibold text-foreground block">
                  Customer Selection
                </label>
                {isCashSale ? (
                  <div className="p-3 rounded-xl bg-accent/50 border text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Walk-in Cash Sale mode enabled. Sale registered under primary cash account.</span>
                  </div>
                ) : (
                  <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                    <PopoverTrigger asChild>
                      {selectedCustomer ? (
                        /* Entire customer card is clickable to reopen selector - NO "Change Customer" button */
                        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserCheck className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-bold text-foreground truncate">{selectedCustomer.name}</span>
                          </div>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
                        </div>
                      ) : (
                        <Button
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
                  </Popover>
                )}
              </div>

              {/* Row 2: Sale Date, Customer Contact Number, Customer Address */}
              <div className={cn("grid grid-cols-1 gap-4", isCashSale ? "md:grid-cols-1" : "md:grid-cols-3")}>
                {/* Sale Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Sale Date
                  </label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-10 text-xs bg-background/50"
                  />
                </div>

                {/* Customer Contact Number */}
                {!isCashSale && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Contact Number
                    </label>
                    <Input
                      readOnly
                      value={selectedCustomer?.phone || ""}
                      placeholder="N/A"
                      className="h-10 text-xs bg-muted/40 text-muted-foreground"
                    />
                  </div>
                )}

                {/* Customer Address */}
                {!isCashSale && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Customer Address
                    </label>
                    <Input
                      readOnly
                      value={selectedCustomer?.address || ""}
                      placeholder="N/A"
                      className="h-10 text-xs bg-muted/40 text-muted-foreground truncate"
                    />
                  </div>
                )}
              </div>

              {/* Row 3: Customer Code, Invoice Number */}
              <div className={cn("grid grid-cols-1 gap-4", isCashSale ? "md:grid-cols-1" : "md:grid-cols-2")}>
                {/* Customer Code */}
                {!isCashSale && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Customer Code
                    </label>
                    <Input
                      readOnly
                      value={selectedCustomer?.customer_code || ""}
                      placeholder="N/A"
                      className="h-10 text-xs bg-muted/40 text-muted-foreground"
                    />
                  </div>
                )}

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Invoice Number <span className="text-muted-foreground font-normal">(Optional)</span>
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

              {/* Row 4: Simplified Single-line Product Search */}
              <div className="space-y-1.5 pt-2 border-t w-full">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" /> Product Search & Add to Invoice
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
                              const isOutOfStock = prod.current_stock <= 0;
                              const formattedLabel = `${prod.name}${prod.product_code ? ` (${prod.product_code})` : ""}`;

                              return (
                                <CommandItem
                                  key={prod.id}
                                  value={`${prod.name} ${prod.product_code || ""} ${prod.barcode || ""} ${prod.id}`}
                                  disabled={isOutOfStock}
                                  onSelect={() => {
                                    if (!isOutOfStock) {
                                      handleSelectProduct(prod);
                                      setOpenProductPopover(false);
                                      setProductSearch("");
                                    }
                                  }}
                                  className={cn(
                                    "py-2.5 px-3 border-b last:border-b-0 hover:bg-accent/70 cursor-pointer text-xs truncate",
                                    isOutOfStock && "opacity-50 cursor-not-allowed bg-muted/20"
                                  )}
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

          {/* Invoice Line Items Table */}
          <Card className="glass-card overflow-hidden w-full">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold">Invoice Items ({lineItems.length})</CardTitle>
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
                        No items added to invoice yet. Search and select products above to populate order.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={`${item.product.id}-${idx}`} className="hover:bg-accent/40 transition-colors">
                        <td className="px-3.5 py-3 align-top">
                          <div className="font-bold text-foreground">{item.product.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Code: {item.product.product_code} | Available Stock: {item.product.current_stock} {item.product.unit}
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
                            max={item.product.current_stock}
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

        {/* Right Column: Order Financial Summary (Span 1) */}
        <div className="space-y-6 lg:col-span-1 w-full">
          <Card className="glass-card sticky top-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Order Summary</span>
                <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                  {isCashSale ? "Cash" : "Credit"}
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
                  <span className="text-muted-foreground">Order Discount ($):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
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
                  <span className="text-muted-foreground">Outstanding Due:</span>
                  <span className={dueAmount > 0 ? "text-amber-500 font-bold" : "text-emerald-500"}>
                    {formatCurrency(dueAmount)}
                  </span>
                </div>
              </div>

              {/* Customer Account Impact */}
              {!isCashSale && selectedCustomer && (
                <div className="p-3 rounded-xl bg-accent/40 border space-y-1 text-[11px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Existing Balance:</span>
                    <span>{formatCurrency(selectedCustomer.current_balance)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                    <span>New Account Due:</span>
                    <span className={projectedCustomerDue > 0 ? "text-amber-500" : "text-emerald-500"}>
                      {formatCurrency(projectedCustomerDue)}
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
                  placeholder="Enter remarks or payment terms..."
                  className="w-full rounded-md border border-input bg-background/50 p-2 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-10 text-xs font-bold"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Sales Invoice
                </Button>

                <Button
                  variant="secondary"
                  className="w-full h-10 text-xs font-bold"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Save & Print Receipt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
