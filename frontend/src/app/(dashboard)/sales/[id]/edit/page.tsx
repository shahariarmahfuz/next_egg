"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Search,
  User,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Package,
  FileText,
  UserCheck,
  Calendar,
  ChevronsUpDown,
} from "lucide-react";
import { customerService, productService, saleService } from "@/services/api";
import { CustomerItem, ProductItem, SaleUpdatePayload, SaleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { HasPermission } from "@/providers/auth-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import {
  calculateDueAmount,
  calculateGrandTotal,
  calculateLineTotal,
  calculateSubtotal,
  calculateUnitPrice,
  roundToPrecision,
} from "@/utils/price";

interface LineItemState {
  product: ProductItem;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  pricing_mode: "unit_price" | "total_price";
  error?: string;
}

export default function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch Existing Sale Invoice Data
  const { data: saleData, isLoading: isSaleLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => saleService.getSaleById(id),
  });

  const sale: SaleItem | undefined = saleData?.data;

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [openProductPopover, setOpenProductPopover] = useState(false);

  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedCustomerQuery = useDebounce(customerSearch, 300);
  const debouncedProductQuery = useDebounce(productSearch, 300);

  // Prefill state from fetched sale invoice
  useEffect(() => {
    if (sale) {
      if (sale.customer) {
        setSelectedCustomer(sale.customer);
      }
      setOrderDiscount(sale.discount_amount);
      setTaxAmount(sale.tax_amount);
      setPaidAmount(sale.paid_amount);
      setNotes(sale.notes || sale.note || "");
      if (sale.sale_date) {
        setSaleDate(new Date(sale.sale_date).toISOString().split("T")[0]);
      }

      if (sale.items) {
        const mappedItems: LineItemState[] = sale.items.map((item) => ({
          product: item.product || ({
            id: item.product_id,
            name: "Product Item",
            product_code: "",
            current_stock: 99999,
            unit: "",
            opening_stock_unit_cost: item.unit_price,
            selling_price: item.unit_price,
            opening_stock: 0,
            minimum_stock: 0,
            status: "active",
            created_at: "",
            updated_at: "",
          } as ProductItem),
          quantity: item.quantity,
          unit_price: roundToPrecision(item.unit_price, 4),
          discount: roundToPrecision(item.discount || 0, 4),
          total_price: roundToPrecision(item.total_price, 4),
          pricing_mode: item.pricing_mode || (
            Math.abs((item.quantity * item.unit_price - (item.discount || 0)) - item.total_price) > 0.001
              ? "total_price"
              : "unit_price"
          ),
        }));
        setLineItems(mappedItems);
      }
    }
  }, [sale]);

  // Customer & Product Search Queries
  const { data: customerSearchData } = useQuery({
    queryKey: ["customers-search", debouncedCustomerQuery],
    queryFn: () => customerService.getCustomers({ search: debouncedCustomerQuery, size: 8 }),
    enabled: debouncedCustomerQuery.trim().length >= 1 && !selectedCustomer,
  });

  const { data: productSearchData, isLoading: isProductLoading } = useQuery({
    queryKey: ["products-search", debouncedProductQuery],
    queryFn: () => productService.getProducts({ search: debouncedProductQuery, status: "active", product_type: "NORMAL", size: 20 }),
    enabled: true,
  });

  const customerSuggestions = customerSearchData?.data?.items || [];
  const productSuggestions = productSearchData?.data?.items || [];

  const handleSelectProduct = (product: ProductItem) => {
    if (product.product_type === "FARM") {
      setErrorMsg(`"${product.name}" is a Farm Product (Quantity Tracking Only) and cannot be sold via regular sales.`);
      return;
    }
    const existingIndex = lineItems.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      const existing = lineItems[existingIndex];
      const newQty = existing.quantity + 1;
      const updated = [...lineItems];
      let newTotal = existing.total_price;
      let newUnit = existing.unit_price;

      if (existing.pricing_mode === "total_price") {
        newUnit = calculateUnitPrice(existing.total_price, newQty, existing.discount);
      } else {
        newTotal = calculateLineTotal(newQty, existing.unit_price, existing.discount);
      }

      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        unit_price: newUnit,
        total_price: newTotal,
      };
      setLineItems(updated);
    } else {
      const newItem: LineItemState = {
        product,
        quantity: 1,
        unit_price: roundToPrecision(product.selling_price, 4),
        discount: 0,
        total_price: calculateLineTotal(1, product.selling_price, 0),
        pricing_mode: "unit_price",
      };
      setLineItems([...lineItems, newItem]);
    }

    setProductSearch("");
    setOpenProductPopover(false);
    setErrorMsg(null);
  };

  const handleUpdateItem = (
    index: number,
    field: "quantity" | "unit_price" | "discount" | "total_price",
    value: number
  ) => {
    const updated = [...lineItems];
    const item = { ...updated[index] };

    if (field === "quantity") {
      item.quantity = value <= 0 ? 1 : value;
      if (item.pricing_mode === "total_price") {
        // Mode B: Total price is authoritative, recalculate unit price
        item.unit_price = calculateUnitPrice(item.total_price, item.quantity, item.discount);
      } else {
        // Mode A: Unit price is authoritative, recalculate total price
        item.total_price = calculateLineTotal(item.quantity, item.unit_price, item.discount);
      }
    } else if (field === "unit_price") {
      item.pricing_mode = "unit_price";
      item.unit_price = value < 0 ? 0 : roundToPrecision(value, 4);
      item.total_price = calculateLineTotal(item.quantity, item.unit_price, item.discount);
    } else if (field === "total_price") {
      item.pricing_mode = "total_price";
      item.total_price = value < 0 ? 0 : roundToPrecision(value, 4);
      if (item.quantity > 0) {
        item.unit_price = calculateUnitPrice(item.total_price, item.quantity, item.discount);
      }
    } else if (field === "discount") {
      item.discount = value < 0 ? 0 : roundToPrecision(value, 4);
      if (item.pricing_mode === "total_price") {
        item.unit_price = calculateUnitPrice(item.total_price, item.quantity, item.discount);
      } else {
        item.total_price = calculateLineTotal(item.quantity, item.unit_price, item.discount);
      }
    }

    updated[index] = item;
    setLineItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = calculateSubtotal(lineItems);
  const grandTotal = calculateGrandTotal(subtotal, orderDiscount, taxAmount);
  const dueAmount = calculateDueAmount(grandTotal, paidAmount);

  const updateSaleMutation = useMutation({
    mutationFn: (payload: SaleUpdatePayload) => saleService.updateSale(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-reports"] });
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      router.push("/sales");
    },
  });

  const handleSubmit = async () => {
    try {
      setErrorMsg(null);
      if (lineItems.length === 0) {
        setErrorMsg("Invoice must contain at least one line item.");
        return;
      }

      setIsSubmitting(true);
      const payload: SaleUpdatePayload = {
        customer_id: selectedCustomer?.id || sale?.customer_id,
        sale_date: saleDate ? new Date(saleDate).toISOString() : undefined,
        discount_amount: roundToPrecision(orderDiscount, 4),
        tax_amount: roundToPrecision(taxAmount, 4),
        paid_amount: roundToPrecision(paidAmount, 4),
        notes: notes.trim(),
        note: notes.trim(),
        items: lineItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: roundToPrecision(item.unit_price, 4),
          discount: roundToPrecision(item.discount, 4),
          total_price: roundToPrecision(item.total_price, 4),
          pricing_mode: item.pricing_mode,
        })),
      };

      await updateSaleMutation.mutateAsync(payload);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update sale invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSaleLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sale invoice not found or has been deleted.
      </div>
    );
  }

  return (
    <HasPermission code="sales.edit">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Edit Sale Invoice #{sale.invoice_no}
            </h1>
            <p className="text-xs text-muted-foreground">
              Modifying invoice line items will automatically recalculate product stock differences and customer balances.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/sales")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sales Directory
          </Button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Picker */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">Customer</label>
                  {selectedCustomer ? (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-primary" />
                          {selectedCustomer.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-[10px] text-destructive hover:bg-destructive/10 h-6 px-2"
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search customer to change..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        className="pl-9 h-10 text-xs"
                      />
                      {showCustomerDropdown && customerSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-11 z-50 bg-card border rounded-xl shadow-2xl overflow-hidden divide-y text-xs">
                          {customerSuggestions.map((cust) => (
                            <div
                              key={cust.id}
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setShowCustomerDropdown(false);
                                setCustomerSearch("");
                              }}
                              className="p-3 hover:bg-accent cursor-pointer flex justify-between"
                            >
                              <span className="font-semibold">{cust.name}</span>
                              <span className="text-muted-foreground">{cust.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Sale Date
                  </label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-10 text-xs bg-background/50"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Add */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Add Product Items
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                                  onSelect={() => {
                                    handleSelectProduct(prod);
                                    setOpenProductPopover(false);
                                    setProductSearch("");
                                  }}
                                  className="py-2.5 px-3 border-b last:border-b-0 hover:bg-accent/70 cursor-pointer text-xs flex items-center justify-between"
                                >
                                  {/* Single line display: Product Name (Product Code) */}
                                  <div className="truncate text-xs font-medium text-foreground min-w-0" title={formattedLabel}>
                                    {formattedLabel}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px] font-semibold shrink-0 ml-2",
                                      prod.current_stock > 0
                                        ? "text-muted-foreground"
                                        : "text-amber-600 dark:text-amber-400 font-bold"
                                    )}
                                  >
                                    Stock: {prod.current_stock}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            {/* Items Table */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Line Items ({lineItems.length})</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center w-24">Qty</th>
                      <th className="p-3 text-center w-28">Price ($)</th>
                      <th className="p-3 text-center w-24">Discount ($)</th>
                      <th className="p-3 text-right w-28">Total ($)</th>
                      <th className="p-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-accent/30">
                        <td className="p-3 font-bold">{item.product.name}</td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="any"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-center font-bold"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-center "
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={item.discount}
                            onChange={(e) => handleUpdateItem(idx, "discount", parseFloat(e.target.value) || 0)}
                            className="h-8 text-center text-amber-500"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={item.total_price}
                            onChange={(e) => handleUpdateItem(idx, "total_price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right font-bold w-28 ml-auto"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right Summary */}
          <div className="space-y-6">
            <Card className="glass-card border-primary/20 shadow-xl">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Invoice Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Order Discount ($):</span>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                    className="h-7 w-28 text-right text-xs"
                  />
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-primary/10 border border-primary/20 font-bold">
                  <span>Grand Total:</span>
                  <span className="text-primary text-lg">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-foreground">Paid Amount ($):</span>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="h-8 w-32 text-right font-bold text-emerald-500"
                  />
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-lg bg-muted/40 border">
                  <span className="font-medium text-muted-foreground">Due Amount:</span>
                  <span className={`font-bold ${dueAmount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                    {formatCurrency(dueAmount)}
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Note (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter remarks, delivery requests, or sale notes..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full h-10 font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Sale...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Sale Invoice
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </HasPermission>
  );
}
