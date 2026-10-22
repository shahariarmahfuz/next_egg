"use client";

import { useState } from "react";
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
  Tag,
  UserCheck,
  Settings as SettingsIcon,
  PackageSearch,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  // Initial state is null (no product auto-selected on load)
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

  // Fetch daily stock report data ONLY when a product is explicitly selected
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
      const tz = (settings?.timezone && settings.timezone !== "UTC")
        ? settings.timezone
        : (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
      return reportService.getStockReport({
        product_id: selectedProduct.id,
        target_date: targetDate,
        timezone: tz,
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
            description="Track daily inventory balances, purchases, sales breakdowns (cash & due), and remaining stock."
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
        <Card className="glass-card print:hidden border shadow-xs">
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
                          Select a product...
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

        {/* Clean Empty State when No Product is Selected */}
        {!selectedProduct && (
          <Card className="border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-8 sm:p-14 text-center rounded-2xl">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                <PackageSearch className="h-7 w-7" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                No Product Selected
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Please search and select a product from the dropdown above to view its daily stock summary, purchases, sales breakdowns, and remaining stock.
              </p>
            </div>
          </Card>
        )}

        {/* Error State */}
        {selectedProduct && reportError && (
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
        {selectedProduct && isReportLoading && !report && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Main Content when Report is loaded */}
        {selectedProduct && report && (
          <div className="space-y-6">
            {/* Unified Modern Product Banner Card */}
            <Card className="border shadow-xs bg-card overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                        {report.product.name}
                      </h2>
                      <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                        {report.product.product_code}
                      </Badge>
                      {report.product.category && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {report.product.category}
                        </Badge>
                      )}
                      {report.product.brand && (
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {report.product.brand}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Report Date: <strong className="text-foreground">{formatDate(report.target_date)}</strong></span>
                      <span>•</span>
                      <span>Unit: <strong className="text-foreground">{report.product.unit}</strong></span>
                      {report.product.selling_price > 0 && (
                        <>
                          <span>•</span>
                          <span>Unit Price: <strong className="text-foreground">{formatCurrency(report.product.selling_price)}</strong></span>
                        </>
                      )}
                      {report.configured_customer && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-700 dark:text-cyan-400 font-medium flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" />
                            Tracked Customer: <strong>{report.configured_customer.name}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Prominent Live Current Stock Box */}
                  <div className="flex items-center gap-3 bg-muted/60 dark:bg-muted/30 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shrink-0 self-start md:self-auto">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Current Live Stock
                      </div>
                      <div className="text-lg sm:text-xl font-extrabold font-mono text-foreground">
                        {formatNumber(report.product.current_stock)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {report.product.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Product Stock Summary - Clean, Modern Minimal Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-4 w-4 text-primary" />
                  Daily Stock Summary ({formatDate(report.target_date)})
                </h3>
              </div>

              <div
                className={`grid grid-cols-2 sm:grid-cols-3 ${
                  report.configured_customer ? "lg:grid-cols-4 xl:grid-cols-7" : "lg:grid-cols-3 xl:grid-cols-6"
                } gap-3 sm:gap-4`}
              >
                {/* Previous Stock */}
                <Card className="border border-l-4 border-l-blue-500 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        Previous Stock
                      </span>
                      <div className="h-6 w-6 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Package className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.previous_stock ?? report.opening_stock)}
                    </div>
                  </CardContent>
                </Card>

                {/* Purchases */}
                <Card className="border border-l-4 border-l-sky-500 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Purchases
                      </span>
                      <div className="h-6 w-6 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono pt-1">
                      +{formatNumber(report.purchases)}
                    </div>
                  </CardContent>
                </Card>

                {/* Total Sales */}
                <Card className="border border-l-4 border-l-purple-500 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                        Total Sales
                      </span>
                      <div className="h-6 w-6 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <TrendingDown className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono pt-1">
                      -{formatNumber(report.sales)}
                    </div>
                  </CardContent>
                </Card>

                {/* Cash Sales */}
                <Card className="border border-l-4 border-l-emerald-500 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Cash Sales
                      </span>
                      <div className="h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.cash_sales)}
                    </div>
                  </CardContent>
                </Card>

                {/* Due Sales */}
                <Card className="border border-l-4 border-l-amber-500 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Due Sales
                      </span>
                      <div className="h-6 w-6 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <CreditCard className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-foreground font-mono pt-1">
                      {formatNumber(report.due_sales)}
                    </div>
                  </CardContent>
                </Card>

                {/* Special Tracked Customer Sales (if configured) */}
                {report.configured_customer && (
                  <Card className="border border-l-4 border-l-cyan-500 shadow-2xs hover:shadow-xs transition-all">
                    <CardContent className="p-3.5 sm:p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 truncate max-w-[120px]"
                          title={report.configured_customer.name}
                        >
                          {report.configured_customer.name}
                        </span>
                        <div className="h-6 w-6 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                          <UserCheck className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-foreground font-mono pt-1">
                        {formatNumber(report.customer_sales)}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Remaining Stock */}
                <Card className="border border-l-4 border-l-indigo-600 dark:border-l-indigo-400 shadow-2xs hover:shadow-xs transition-all">
                  <CardContent className="p-3.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        Remaining Stock
                      </span>
                      <div className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Boxes className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-primary font-mono pt-1">
                      {formatNumber(report.remaining_stock)}
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
