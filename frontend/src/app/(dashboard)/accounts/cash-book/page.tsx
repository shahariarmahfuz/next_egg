"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCw,
  TrendingDown,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Building2,
  Receipt,
  ShoppingCart,
  DollarSign,
  Landmark,
} from "lucide-react";
import { accountsService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HasPermission } from "@/providers/auth-provider";
import { usePrint } from "@/lib/print-service";
import { PrintableCashBookStatement } from "@/components/accounts/printable-cash-book-statement";
import { formatCurrency } from "@/utils/formatters";
import { PageHeader } from "@/components/common/page-header";
import { cn } from "@/lib/utils";

export default function CashBookPage() {
  // Get today's local ISO date (YYYY-MM-DD)
  const getTodayISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO);
  const [isPending, startTransition] = useTransition();
  const { printDocument, isPrinting } = usePrint();

  // Navigation helpers
  const handlePreviousDay = () => {
    startTransition(() => {
      const current = new Date(selectedDate);
      current.setDate(current.getDate() - 1);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      setSelectedDate(`${year}-${month}-${day}`);
    });
  };

  const handleNextDay = () => {
    startTransition(() => {
      const current = new Date(selectedDate);
      current.setDate(current.getDate() + 1);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      setSelectedDate(`${year}-${month}-${day}`);
    });
  };

  const handleToday = () => {
    startTransition(() => {
      setSelectedDate(getTodayISO());
    });
  };

  // Fetch Cash Book data for the selected date
  const {
    data: cashBookData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["cash-book", selectedDate],
    queryFn: () => accountsService.getCashBook({ target_date: selectedDate }),
  });

  const summary = cashBookData?.data;

  // Print Handler
  const handlePrint = async () => {
    if (!summary) return;
    await printDocument(<PrintableCashBookStatement summary={summary} />);
  };

  // Helper for badge styling based on transaction type
  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "opening_balance":
        return <Badge variant="outline" className="bg-muted/50 text-muted-foreground font-semibold">Opening</Badge>;
      case "cash_sale":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold">Cash Sale</Badge>;
      case "collection":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">Collection</Badge>;
      case "expense":
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-semibold">Expense</Badge>;
      case "supplier_payment":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">Supplier Pay</Badge>;
      case "cash_purchase":
        return <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-semibold">Cash Purchase</Badge>;
      case "sale_return_refund":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 font-semibold">Return Refund</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <HasPermission
      code="accounts.cash_book.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view the Cash Book.
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header & Date Navigation Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Cash Book"
            description="Daily Cash Statement & Real-time Cash In Hand Ledger"
          />

          {/* Date controls and Print button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-background/50 p-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousDay}
                className="h-8 px-2 text-xs"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className={cn("h-8 px-2.5 text-xs font-semibold", selectedDate === getTodayISO() && "bg-accent")}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextDay}
                className="h-8 px-2 text-xs"
                title="Next Day"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-36 text-xs font-medium cursor-pointer"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-9 gap-1.5 text-xs"
              title="Refresh"
            >
              <RotateCw className={cn("h-3.5 w-3.5", (isRefetching || isLoading) && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              disabled={!summary || isPrinting}
              className="h-9 gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Statement</span>
            </Button>
          </div>
        </div>

        {/* Compact Summary Cards (Section 7) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* 1. Previous Balance */}
          <Card className="glass-card p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Previous Balance</span>
              <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-foreground">
                {formatCurrency(summary?.previous_balance)}
              </span>
            </div>
          </Card>

          {/* 2. Today's Cash Received */}
          <Card className="glass-card p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Today's Received</span>
              <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(summary?.today_cash_received)}
              </span>
            </div>
          </Card>

          {/* 3. Today's Cash Expense */}
          <Card className="glass-card p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Today's Expense</span>
              <div className="h-6 w-6 rounded-md bg-rose-500/10 flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                -{formatCurrency(summary?.today_cash_expense)}
              </span>
            </div>
          </Card>

          {/* 4. Cash in Hand (Highlighted) */}
          <Card className="glass-card p-3 rounded-xl border-emerald-500/30 bg-emerald-500/5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                Cash in Hand
              </span>
              <div className="h-6 w-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                {formatCurrency(summary?.cash_in_hand)}
              </span>
            </div>
          </Card>

          {/* 5. Total Cash Received */}
          <Card className="glass-card p-3 rounded-xl hidden lg:block">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Total Received</span>
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(summary?.total_cash_received)}
              </span>
            </div>
          </Card>

          {/* 6. Total Cash Paid */}
          <Card className="glass-card p-3 rounded-xl hidden lg:block">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Total Paid</span>
              <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(summary?.total_cash_paid)}
              </span>
            </div>
          </Card>

          {/* 7. Closing Cash Balance */}
          <Card className="glass-card p-3 rounded-xl hidden lg:block">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground truncate">Closing Balance</span>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Landmark className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-base font-bold text-foreground">
                {formatCurrency(summary?.closing_cash_balance)}
              </span>
            </div>
          </Card>
        </div>

        {/* Cash Book Ledger Table (Section 6) */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span>Cash Transactions Ledger — {summary?.date || selectedDate}</span>
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              <span>Timezone: </span>
              <span className="font-semibold text-foreground">{summary?.timezone || "UTC"}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-24">Date</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3 w-28">Code / Ref</th>
                    <th className="py-3 px-3 w-36">Name</th>
                    <th className="py-3 px-3 w-28">Invoice / Trans</th>
                    <th className="py-3 px-3 w-28 text-right text-rose-600 dark:text-rose-400 font-bold">
                      Debit (Out)
                    </th>
                    <th className="py-3 px-3 w-28 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      Credit (In)
                    </th>
                    <th className="py-3 px-3 w-32 text-right font-bold text-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <RotateCw className="h-4 w-4 animate-spin text-primary" />
                          <span>Loading cash book ledger...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !summary || summary.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground italic">
                        No cash transactions recorded for this business date.
                      </td>
                    </tr>
                  ) : (
                    summary.items.map((item, idx) => {
                      const isOpening = item.transaction_type === "opening_balance";
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            isOpening && "bg-muted/20 font-semibold"
                          )}
                        >
                          <td className="py-2.5 px-3 text-center text-muted-foreground text-[11px]">
                            {isOpening ? "—" : idx}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            <div>{item.formatted_date}</div>
                            {item.formatted_time !== "—" && (
                              <div className="text-[10px] opacity-70">{item.formatted_time}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {getTransactionBadge(item.transaction_type)}
                              <span className="font-medium text-foreground">{item.description}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="py-2.5 px-3 text-foreground truncate max-w-[150px]">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-primary whitespace-nowrap">
                            {item.invoice}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-medium text-rose-600 dark:text-rose-400">
                            {item.debit > 0 ? formatCurrency(item.debit) : "0"}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400">
                            {item.credit > 0 ? formatCurrency(item.credit) : "0"}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-bold text-foreground">
                            {formatCurrency(item.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {summary && summary.items.length > 0 && (
                  <tfoot className="bg-muted/30 font-bold border-t text-xs">
                    <tr>
                      <td colSpan={6} className="py-3 px-3 text-right text-muted-foreground">
                        Today's Total Cash Activity
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCurrency(summary.today_cash_expense)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(summary.today_cash_received)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-foreground">
                        {formatCurrency(summary.closing_cash_balance)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </HasPermission>
  );
}
