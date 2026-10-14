"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Calendar,
  Search,
  Printer,
  RotateCcw,
  Package,
  TrendingDown,
  TrendingUp,
  DollarSign,
  CreditCard,
  ChevronsUpDown,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  Tag,
  Barcode,
  Layers,
  UserCheck,
  Settings as SettingsIcon,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

import { productService, reportService } from "@/services/api";
import { ProductItem, DailyStockReportData } from "@/types";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";
import { HasPermission } from "@/providers/auth-provider";

export default function StockReportPage() {
  const { settings } = useSettingsStore();
  const getTodayStr = () => new Date().toLocaleDateString("en-CA");

  const [targetDate, setTargetDate] = useState<string>(getTodayStr());
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [productSearch, setProductSearch] = useState<string>("");
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState<boolean>(false);

  const debouncedProductQuery = useDebounce(productSearch, 300);

  // Fetch product search suggestions
  const { data: productSearchData, isLoading: isSearchingProducts } = useQuery({
    queryKey: ["stock-report-products", debouncedProductQuery],
    queryFn: () =>
      productService.getProducts({
        search: debouncedProductQuery || undefined,
        size: 25,
      }),
  });

  const productSuggestions: ProductItem[] = productSearchData?.data?.items || [];

  // Automatically select the first product if none selected and catalog exists
  useEffect(() => {
    if (!selectedProduct && productSuggestions.length > 0 && !debouncedProductQuery) {
      setSelectedProduct(productSuggestions[0]);
    }
  }, [productSuggestions, selectedProduct, debouncedProductQuery]);

  // Fetch daily stock report data
  const {
    data: stockReportData,
    isLoading: isReportLoading,
    isFetching: isReportFetching,
    error: reportError,
    refetch,
  } = useQuery({
    queryKey: ["daily-stock-report", selectedProduct?.id, targetDate],
    queryFn: () => {
      if (!selectedProduct?.id) return null;
      return reportService.getStockReport({
        product_id: selectedProduct.id,
        target_date: targetDate,
        timezone: settings.timezone || "UTC",
      });
    },
    enabled: !!selectedProduct?.id && !!targetDate,
  });

  const report: DailyStockReportData | undefined = stockReportData?.data;

  const handlePrint = () => {
    window.print();
  };

  const handleDatePreset = (preset: "today" | "yesterday") => {
    const d = new Date();
    if (preset === "yesterday") {
      d.setDate(d.getDate() - 1);
    }
    setTargetDate(d.toLocaleDateString("en-CA"));
  };

  return (
    <HasPermission
      code="stock_report.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Stock Reports.
        </div>
      }
    >
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Page Header (Hidden on print) */}
        <div className="print:hidden">
          <PageHeader
            title="Daily Product Stock Report"
            description="Track daily inventory opening balances, purchases, sales breakdowns (cash & due), and closing stock."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/settings/stock-report">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    <SettingsIcon className="h-3.5 w-3.5" />
                    Customer Setting
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={!report}
                  className="h-9 gap-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Report
                </Button>
              </div>
            }
          />
        </div>

        {/* Printable Letterhead Header */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {settings.business_name || "Business Management System"}
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Daily Product Stock Report
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Date: {formatDate(targetDate)}</div>
              <div>Generated: {formatDate(new Date())}</div>
            </div>
          </div>
        </div>

        {/* Filters Card (Hidden on print) */}
        <Card className="glass-card print:hidden border-primary/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Product Selector */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  Select Product *
                </label>
                <Popover
                  open={isProductPopoverOpen}
                  onOpenChange={setIsProductPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isProductPopoverOpen}
                      className="w-full justify-between h-10 text-xs font-normal bg-background/50 border-input hover:bg-accent/50"
                    >
                      {selectedProduct ? (
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-foreground truncate">
                            {selectedProduct.name}
                          </span>
                          {selectedProduct.product_code && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                              {selectedProduct.product_code}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            ({selectedProduct.unit})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Search className="h-3.5 w-3.5 opacity-70" />
                          Choose a product...
                        </span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                    align="start"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name, code, barcode..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        {isSearchingProducts ? (
                          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            Searching products...
                          </div>
                        ) : productSuggestions.length === 0 ? (
                          <CommandEmpty>No products found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {productSuggestions.map((prod) => {
                              const isSelected = selectedProduct?.id === prod.id;
                              return (
                                <CommandItem
                                  key={prod.id}
                                  value={`${prod.name} ${prod.product_code || ""} ${prod.barcode || ""}`}
                                  onSelect={() => {
                                    setSelectedProduct(prod);
                                    setIsProductPopoverOpen(false);
                                  }}
                                  className="py-2 px-3 border-b last:border-b-0 cursor-pointer flex items-center justify-between"
                                >
                                  <div className="truncate pr-2">
                                    <div className="text-xs font-medium text-foreground truncate">
                                      {prod.name}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                      <span>Code: {prod.product_code}</span>
                                      <span>•</span>
                                      <span>Unit: {prod.unit}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] py-0 px-1.5 h-4 font-mono"
                                    >
                                      Stock: {formatNumber(prod.current_stock)}
                                    </Badge>
                                    {isSelected && (
                                      <Check className="h-3.5 w-3.5 text-primary" />
                                    )}
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

              {/* Date Filter */}
              <div className="md:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Report Date *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDatePreset("today")}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                        targetDate === getTodayStr()
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset("yesterday")}
                      className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:bg-accent font-medium transition-colors"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-10 text-xs bg-background/50 border-input font-medium"
                />
              </div>

              {/* Refresh / Status */}
              <div className="md:col-span-2 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isReportFetching || !selectedProduct}
                  className="h-10 w-full gap-1.5 text-xs font-medium"
                >
                  <RotateCcw
                    className={`h-3.5 w-3.5 ${isReportFetching ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {reportError && (
          <Card className="border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-xs text-destructive">
                Failed to load stock report for this product. Please try again.
              </div>
            </div>
          </Card>
        )}

        {/* Loading Skeleton */}
        {isReportLoading && !report && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Main Content when Report is loaded */}
        {report && (
          <div className="space-y-6">
            {/* Selected Product Banner Card */}
            <Card className="glass-card border-primary/20 bg-gradient-to-r from-card via-card to-accent/20">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-foreground">
                        {report.product.name}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono py-0.5">
                        {report.product.product_code}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Unit: {report.product.unit}
                      </Badge>
                      {report.product.category && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {report.product.category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Report Target: <strong className="text-foreground">{formatDate(report.target_date)}</strong></span>
                      <span>•</span>
                      <span>Timezone: <strong>{report.timezone}</strong></span>
                      {report.configured_customer && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium">
                            <UserCheck className="h-3 w-3" />
                            Configured Customer: <strong>{report.configured_customer.name}</strong>
                          </span>
                        </>
                      )}
                      {report.product.selling_price > 0 && (
                        <>
                          <span>•</span>
                          <span>Unit Price: <strong>{formatCurrency(report.product.selling_price)}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                        Current Live Stock
                      </div>
                      <div className="text-base font-extrabold text-foreground font-mono">
                        {formatNumber(report.product.current_stock)} {report.product.unit}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Product Stock Summary - The 6 Required Metrics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-4 w-4 text-primary" />
                  Daily Stock Summary ({formatDate(report.target_date)})
                </h3>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {report.configured_customer
                    ? "Sales = Cash + Due + Customer Sales | Closing Stock = Opening + Purchases − Sales"
                    : "Closing Stock = Opening Stock + Purchases − Sales"}
                </span>
              </div>

              <div
                className={`grid grid-cols-2 md:grid-cols-3 ${
                  report.configured_customer ? "lg:grid-cols-7" : "lg:grid-cols-6"
                } gap-3`}
              >
                {/* 1. Opening Stock */}
                <Card className="glass-card border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 transition-all">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        1. Opening Stock
                      </span>
                      <Package className="h-3.5 w-3.5 text-blue-500/60" />
                    </div>
                    <div className="text-xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.opening_stock)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Start of day balance
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Purchases */}
                <Card className="glass-card border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40 transition-all">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        2. Purchases
                      </span>
                      <TrendingUp className="h-3.5 w-3.5 text-sky-500/60" />
                    </div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono pt-1">
                      +{formatNumber(report.purchases)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Purchased on day
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Sales (Total) */}
                <Card className="glass-card border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 transition-all">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        3. Total Sales
                      </span>
                      <TrendingDown className="h-3.5 w-3.5 text-purple-500/60" />
                    </div>
                    <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono pt-1">
                      -{formatNumber(report.sales)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Total quantity sold
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Cash Sales */}
                <Card className="glass-card border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-all">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        4. Cash Sales
                      </span>
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500/60" />
                    </div>
                    <div className="text-xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.cash_sales)}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Paid portion
                    </div>
                  </CardContent>
                </Card>

                {/* 5. Due Sales */}
                <Card className="glass-card border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-all">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        5. Due Sales
                      </span>
                      <CreditCard className="h-3.5 w-3.5 text-amber-500/60" />
                    </div>
                    <div className="text-xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.due_sales)}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Credit / due portion
                    </div>
                  </CardContent>
                </Card>

                {/* Dedicated Customer Sales (Only when a customer is configured in Settings) */}
                {report.configured_customer && (
                  <Card className="glass-card border-cyan-500/30 bg-cyan-500/10 hover:border-cyan-500/50 transition-all">
                    <CardContent className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 truncate max-w-[120px]"
                          title={report.configured_customer.name}
                        >
                          {report.configured_customer.name}
                        </span>
                        <UserCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      </div>
                      <div className="text-xl font-black text-foreground font-mono pt-1">
                        {formatNumber(report.customer_sales)}
                      </div>
                      <div className="text-[10px] text-cyan-700 dark:text-cyan-300 font-medium truncate">
                        Selected Customer Sales
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 6. Remaining Stock */}
                <Card className="glass-card border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-500/50 transition-all shadow-sm">
                  <CardContent className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        Remaining Stock
                      </span>
                      <Boxes className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <div className="text-xl font-black text-primary font-mono pt-1">
                      {formatNumber(report.remaining_stock)}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      End of day balance
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Returns Notice (if any occurred on that day) */}
              {(report.purchase_returns > 0 || report.sale_returns > 0) && (
                <div className="mt-3 flex items-center gap-2 text-xs bg-accent/40 rounded-lg p-2.5 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Note: Day includes{" "}
                    {report.purchase_returns > 0 && (
                      <strong className="text-foreground">
                        {formatNumber(report.purchase_returns)} {report.product.unit} Purchase Returns (deducted){" "}
                      </strong>
                    )}
                    {report.purchase_returns > 0 && report.sale_returns > 0 && "and "}
                    {report.sale_returns > 0 && (
                      <strong className="text-foreground">
                        {formatNumber(report.sale_returns)} {report.product.unit} Sale Returns (restocked)
                      </strong>
                    )}
                    . These are factored directly into Remaining Stock.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </HasPermission>
  );
}
