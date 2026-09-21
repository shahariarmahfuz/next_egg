"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  Calendar,
  Printer,
  FileText,
  Loader2,
  ChevronsUpDown,
  Truck,
  Phone,
  MapPin,
  ExternalLink,
} from "lucide-react";
import {
  supplierService,
  purchaseService,
  supplierPaymentService,
  productReturnService,
} from "@/services/api";
import {
  SupplierItem,
  SupplierLedgerTransaction,
  PurchaseItem,
  SupplierPaymentItem,
  ProductReturnItem,
} from "@/types";
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
import { PurchaseViewModal } from "@/components/purchases/purchase-view-modal";
import { SupplierPaymentViewModal } from "@/components/supplier-payments/supplier-payment-view-modal";
import { ProductReturnViewModal } from "@/components/product-returns/product-return-view-modal";
import { HasPermission } from "@/providers/auth-provider";
import { usePrint } from "@/lib/print-service";
import { PrintableSupplierStatement } from "@/components/suppliers/printable-supplier-statement";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function SupplierLedgerPage() {
  // Supplier Search & Selection
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [openSupplierPopover, setOpenSupplierPopover] = useState(false);

  // Date Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modal States
  const [selectedViewPurchase, setSelectedViewPurchase] = useState<PurchaseItem | null>(null);
  const [selectedViewPayment, setSelectedViewPayment] = useState<SupplierPaymentItem | null>(null);
  const [selectedViewReturn, setSelectedViewReturn] = useState<ProductReturnItem | null>(null);

  const debouncedSupplierQuery = useDebounce(supplierSearch, 300);

  // Fetch Suppliers Suggestions
  const { data: supplierSearchData, isLoading: isSupplierLoading } = useQuery({
    queryKey: ["suppliers-search-ledger", debouncedSupplierQuery],
    queryFn: () => supplierService.getSuppliers({ search: debouncedSupplierQuery, size: 20 }),
  });

  const supplierSuggestions: SupplierItem[] = supplierSearchData?.data?.items || [];

  const getIsoDate = (d?: string, endOfDay = false) => {
    if (!d || !d.trim()) return undefined;
    try {
      const dateStr = endOfDay ? `${d.trim()}T23:59:59` : d.trim();
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    } catch {
      return undefined;
    }
  };

  // Fetch Supplier Ledger Data from Backend Service
  const { data: ledgerDataRes, isLoading: isLedgerLoading } = useQuery({
    queryKey: ["supplier-ledger", selectedSupplier?.id, startDate, endDate],
    queryFn: () =>
      supplierService.getSupplierLedger(selectedSupplier!.id, {
        start_date: getIsoDate(startDate),
        end_date: getIsoDate(endDate, true),
      }),
    enabled: !!selectedSupplier?.id,
  });

  const ledgerData = ledgerDataRes?.data;
  const transactions: SupplierLedgerTransaction[] = ledgerData?.transactions || [];
  const summary = ledgerData?.summary || {
    opening_balance: selectedSupplier?.opening_balance || 0,
    total_purchases: 0,
    total_payments: 0,
    total_returns: 0,
    manual_adjustments: 0,
    current_due: selectedSupplier?.current_balance || 0,
  };

  // Click handler for Purchase / Payment / Return vouchers
  const handleVoucherClick = async (tx: SupplierLedgerTransaction) => {
    if (tx.reference_type === "purchase" && tx.reference_id) {
      try {
        const res = await purchaseService.getPurchaseById(tx.reference_id);
        if (res.data) {
          setSelectedViewPurchase(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch purchase details:", err);
      }
    } else if (tx.reference_type === "supplier_payment" && tx.reference_id) {
      try {
        const res = await supplierPaymentService.getSupplierPaymentById(tx.reference_id);
        if (res.data) {
          setSelectedViewPayment(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch payment details:", err);
      }
    } else if (tx.reference_type === "product_return" && tx.reference_id) {
      try {
        const res = await productReturnService.getProductReturnById(tx.reference_id);
        if (res.data) {
          setSelectedViewReturn(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch product return details:", err);
      }
    }
  };

  // Quick Date Filter Presets
  const handleQuickDateFilter = (preset: "all" | "this_month" | "last_30" | "this_year") => {
    const today = new Date();
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    } else if (preset === "last_30") {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    } else if (preset === "this_year") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    }
  };

  const { printDocument, isPrinting, registerPrintHandler } = usePrint();

  // Printable Statement using dedicated report layout
  const handlePrintStatement = async () => {
    if (!selectedSupplier) return;
    await printDocument(
      <PrintableSupplierStatement
        supplier={selectedSupplier}
        summary={summary}
        transactions={transactions}
        startDate={startDate}
        endDate={endDate}
      />
    );
  };

  useEffect(() => {
    if (selectedSupplier) {
      return registerPrintHandler(handlePrintStatement);
    }
  }, [selectedSupplier, summary, transactions, startDate, endDate, registerPrintHandler]);

  return (
    <HasPermission code="supplier.view">
      <div className="space-y-6 py-4 print:hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" /> Supplier Ledger
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Single financial source of truth for supplier transactions, running balance, and account history.
            </p>
          </div>

          {selectedSupplier && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintStatement}
                className="text-xs font-semibold h-9"
              >
                <Printer className="mr-1.5 h-4 w-4 text-primary" /> Print / Export PDF
              </Button>
            </div>
          )}
        </div>

        {/* 1. Supplier Selection Card */}
        <Card className="glass-card">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Supplier Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5 w-full max-w-xl">
              <label className="text-xs font-semibold text-foreground block">
                Search Supplier (Name, Code, Phone)
              </label>
              <Popover open={openSupplierPopover} onOpenChange={setOpenSupplierPopover}>
                <PopoverTrigger asChild>
                  {selectedSupplier ? (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <Truck className="h-4 w-4 text-primary shrink-0" />
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
                        Type name, phone number, or supplier code to search...
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
                          Searching supplier directory...
                        </div>
                      ) : supplierSuggestions.length === 0 ? (
                        <CommandEmpty>No matching suppliers found.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {supplierSuggestions.map((supp) => (
                            <CommandItem
                              key={supp.id}
                              value={`${supp.name} ${supp.supplier_code || ""} ${supp.phone || ""} ${supp.id}`}
                              onSelect={() => {
                                setSelectedSupplier(supp);
                                setOpenSupplierPopover(false);
                                setSupplierSearch("");
                              }}
                              className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs"
                            >
                              <span className="font-medium text-foreground">
                                {supp.name}{supp.phone ? ` (${supp.phone})` : ""}
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

            {/* Selected Supplier Details Header Banner */}
            {selectedSupplier && (
              <div className="p-4 rounded-xl bg-accent/40 border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Supplier Name</span>
                  <span className="font-bold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                    <Truck className="h-3.5 w-3.5 text-primary" /> {selectedSupplier.name}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Supplier Code</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {selectedSupplier.supplier_code}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Contact Phone</span>
                  <span className="font-medium text-foreground text-xs flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 text-muted-foreground" /> {selectedSupplier.phone || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Supplier Address</span>
                  <span className="font-medium text-foreground text-xs flex items-center gap-1 mt-0.5 truncate" title={selectedSupplier.address || "N/A"}>
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" /> {selectedSupplier.address || "N/A"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt when no supplier is selected */}
        {!selectedSupplier ? (
          <Card className="glass-card p-12 text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-bold text-foreground">No Supplier Selected</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Please search and select a supplier above to view their financial ledger statement, running due balance, and complete transaction history.
            </p>
          </Card>
        ) : (
          <>
            {/* 2. Date Range Filter Toolbar */}
            <Card className="glass-card">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">Date From:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs w-36 bg-background/50"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">Date To:</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 text-xs w-36 bg-background/50"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickDateFilter("all")}
                    className="h-7 text-[11px] px-2.5"
                  >
                    All Time
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickDateFilter("this_month")}
                    className="h-7 text-[11px] px-2.5"
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickDateFilter("last_30")}
                    className="h-7 text-[11px] px-2.5"
                  >
                    Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickDateFilter("this_year")}
                    className="h-7 text-[11px] px-2.5"
                  >
                    This Year
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3. Top Summary Cards (6 Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Card 1: Opening Balance */}
              <Card className="glass-card">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    Opening Balance
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(summary.opening_balance)}
                  </span>
                </CardContent>
              </Card>

              {/* Card 2: Total Purchases */}
              <Card className="glass-card border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-blue-600 font-semibold uppercase block mb-1">
                    Total Purchases
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(summary.total_purchases)}
                  </span>
                </CardContent>
              </Card>

              {/* Card 3: Total Payments */}
              <Card className="glass-card border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase block mb-1">
                    Total Payments
                  </span>
                  <span className="text-lg font-bold text-emerald-600">
                    {formatCurrency(summary.total_payments)}
                  </span>
                </CardContent>
              </Card>

              {/* Card 4: Total Returns */}
              <Card className="glass-card border-purple-500/20 bg-purple-500/5">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-purple-600 font-semibold uppercase block mb-1">
                    Total Returns
                  </span>
                  <span className="text-lg font-bold text-purple-600">
                    {formatCurrency(summary.total_returns)}
                  </span>
                </CardContent>
              </Card>

              {/* Card 5: Adjustments */}
              <Card className="glass-card border-indigo-500/20 bg-indigo-500/5">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-indigo-600 font-semibold uppercase block mb-1">
                    Adjustments
                  </span>
                  <span className="text-lg font-bold text-indigo-600">
                    {formatCurrency(summary.manual_adjustments)}
                  </span>
                </CardContent>
              </Card>

              {/* Card 6: Current Balance */}
              <Card className="glass-card border-amber-500/30 bg-amber-500/10">
                <CardContent className="p-3.5">
                  <span className="text-[10px] text-amber-600 font-semibold uppercase block mb-1">
                    Current Balance
                  </span>
                  <span className={`text-lg font-extrabold ${summary.current_due > 0 ? "text-amber-500" : summary.current_due < 0 ? "text-blue-500" : "text-emerald-500"}`}>
                    {summary.current_due < 0 && "-"}
                    {formatCurrency(Math.abs(summary.current_due))}
                  </span>
                  {summary.current_due > 0 && <span className="text-[10px] text-amber-600 ml-1 font-medium">(Due)</span>}
                  {summary.current_due < 0 && <span className="text-[10px] text-blue-600 ml-1 font-medium">(Advance)</span>}
                  {summary.current_due === 0 && <span className="text-[10px] text-emerald-600 ml-1 font-medium">(Paid)</span>}
                </CardContent>
              </Card>
            </div>

            {/* 4. Complete Transaction History Table */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Chronological Transaction History ({transactions.length} entries)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                      <th className="px-3 py-2.5 align-middle whitespace-nowrap">Date</th>
                      <th className="px-3 py-2.5 align-middle whitespace-nowrap">Voucher No.</th>
                      <th className="px-3 py-2.5 align-middle whitespace-nowrap">Type</th>
                      <th className="px-3 py-2.5 align-middle whitespace-nowrap">Description</th>
                      <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Debit ($)</th>
                      <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Credit ($)</th>
                      <th className="px-3 py-2.5 align-middle text-right whitespace-nowrap">Running Due ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLedgerLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="h-10">
                          <td className="px-3 py-2 text-center"><div className="h-4 w-4 bg-muted animate-pulse rounded mx-auto" /></td>
                          <td className="px-3 py-2"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                          <td className="px-3 py-2"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                          <td className="px-3 py-2"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                          <td className="px-3 py-2"><div className="h-4 w-40 bg-muted animate-pulse rounded" /></td>
                          <td className="px-3 py-2 text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                          <td className="px-3 py-2 text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                          <td className="px-3 py-2 text-right"><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No transactions recorded for this supplier in the selected date range.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-accent/40 transition-colors h-10">
                          <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-3 py-2 align-middle font-medium whitespace-nowrap">
                            {tx.reference_id ? (
                              <button
                                type="button"
                                onClick={() => handleVoucherClick(tx)}
                                className="text-primary hover:underline font-bold text-left cursor-pointer flex items-center gap-1 group"
                                title={`Click to view ${tx.type} details`}
                              >
                                <span>{tx.voucher_no}</span>
                                <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                              </button>
                            ) : (
                              <span className="text-muted-foreground">{tx.voucher_no}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle whitespace-nowrap">
                            <Badge
                              variant={
                                tx.type === "Purchase"
                                  ? "default"
                                  : tx.type === "Supplier Payment"
                                  ? "success"
                                  : tx.type === "Purchase Return"
                                  ? "secondary"
                                  : tx.type === "Opening Balance"
                                  ? "outline"
                                  : "warning"
                              }
                              className="text-[10px] py-0 px-2 h-5 font-semibold"
                            >
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 align-middle text-foreground max-w-[280px] truncate" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="px-3 py-2 align-middle text-right font-medium text-emerald-600 whitespace-nowrap">
                            {tx.debit > 0 ? formatCurrency(tx.debit) : "-"}
                          </td>
                          <td className="px-3 py-2 align-middle text-right font-medium text-purple-600 whitespace-nowrap">
                            {tx.credit > 0 ? formatCurrency(tx.credit) : "-"}
                          </td>
                          <td className="px-3 py-2 align-middle text-right font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(tx.running_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Modals */}
            <PurchaseViewModal
              purchase={selectedViewPurchase}
              isOpen={!!selectedViewPurchase}
              onClose={() => setSelectedViewPurchase(null)}
            />

            <SupplierPaymentViewModal
              payment={selectedViewPayment}
              isOpen={!!selectedViewPayment}
              onClose={() => setSelectedViewPayment(null)}
            />

            <ProductReturnViewModal
              productReturn={selectedViewReturn}
              isOpen={!!selectedViewReturn}
              onClose={() => setSelectedViewReturn(null)}
            />
          </>
        )}
      </div>
    </HasPermission>
  );
}
