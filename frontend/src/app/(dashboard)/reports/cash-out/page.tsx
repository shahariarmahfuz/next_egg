"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Printer,
  Loader2,
  FileText,
  DollarSign,
  Layers,
  User,
  ArrowUpRight,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  X,
  Building2,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { reportService, userService } from "@/services/api";
import { CashOutReportItem, CashOutReportData, UserItem } from "@/types";
import { formatCurrency, formatDateTime, formatDate, formatNumber } from "@/utils/formatters";
import { printCashOutReport, printCashOutVoucher } from "@/components/accounts/cash-out-export-utils";

// Format helper for calendar display
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  } catch {
    return dateStr;
  }
}

export default function CashOutReportPage() {
  const { hasPermission } = useAuth();
  const today = new Date().toLocaleDateString("en-CA");

  // Filters State
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Modals & Print State
  const [viewingItem, setViewingItem] = useState<CashOutReportItem | null>(null);
  const [printingVoucherId, setPrintingVoucherId] = useState<string | null>(null);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  // Quick Date Navigation
  const parseAndShift = (dateStr: string, days: number): string => {
    try {
      const parts = (dateStr || today).split("-");
      const d = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10) + days
      );
      return d.toLocaleDateString("en-CA");
    } catch {
      return today;
    }
  };

  const shiftDays = (delta: number) => {
    setStartDate((prev) => parseAndShift(prev, delta));
    setEndDate((prev) => parseAndShift(prev, delta));
    setPage(1);
  };

  const goToToday = () => {
    setStartDate(today);
    setEndDate(today);
    setPage(1);
  };

  // Fetch Users for creator filter (only if has user.view permission)
  const canViewUsers = hasPermission("user.view");
  const { data: usersData } = useQuery({
    queryKey: ["users-cash-out-report-filter"],
    queryFn: () => userService.getUsers({ size: 100 }),
    enabled: canViewUsers,
    staleTime: 5 * 60 * 1000,
  });
  const usersList: UserItem[] = usersData?.data?.items || [];

  // Query: Standalone Cash Out Report Data
  const {
    data: reportResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "cash-out-report",
      startDate,
      endDate,
      search,
      selectedUserId,
      page,
      pageSize,
    ],
    queryFn: () =>
      reportService.getCashOutReport({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: search.trim() || undefined,
        created_by_id: selectedUserId || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: hasPermission("cash_out_report.view"),
  });

  const report: CashOutReportData | undefined = reportResponse?.data;
  const summary = report?.summary || {
    total_cash_outs: 0,
    total_amount: 0,
    average_amount: 0,
    top_reason: null,
    top_reason_amount: 0,
  };
  const items = report?.items || [];
  const totalCount = report?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Print Handlers
  const handlePrintVoucher = async (item: CashOutReportItem) => {
    try {
      setPrintingVoucherId(item.id);
      await printCashOutVoucher(item);
    } catch (err) {
      console.error("Failed to print cash out voucher:", err);
    } finally {
      setPrintingVoucherId(null);
    }
  };

  const handlePrintFullReport = async () => {
    if (!report) return;
    try {
      setIsPrintingReport(true);
      await printCashOutReport(report);
    } catch (err) {
      console.error("Failed to print cash out report:", err);
    } finally {
      setIsPrintingReport(false);
    }
  };

  return (
    <HasPermission
      code="cash_out_report.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Cash Out Reports.
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header & Date Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <PageHeader
            title="Cash Out Report"
            description="Comprehensive breakdown of physical cash withdrawals, owner withdrawals, and non-expense cash-out transactions."
          />

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Quick Date Shift Bar */}
            <div className="flex items-center gap-1 bg-card/60 backdrop-blur-sm p-1 rounded-xl border border-border/70 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => shiftDays(-1)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                title="Previous Day (-1d)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={startDate === today && endDate === today ? "default" : "ghost"}
                size="sm"
                onClick={goToToday}
                className="h-8 px-3 text-xs font-semibold rounded-lg"
                title="Reset to Today"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => shiftDays(1)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                title="Next Day (+1d)"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Date Pickers Container */}
            <div className="flex items-center gap-2 bg-card/60 backdrop-blur-sm p-1.5 rounded-xl border border-border/70 shadow-2xs">
              <div className="flex items-center space-x-1.5">
                <Label htmlFor="start_date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                  From
                </Label>
                <Input
                  type="date"
                  id="start_date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-auto h-8 text-xs bg-background/80 border-border/60 rounded-lg"
                />
              </div>
              <span className="text-muted-foreground/40 text-xs font-bold">—</span>
              <div className="flex items-center space-x-1.5">
                <Label htmlFor="end_date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  To
                </Label>
                <Input
                  type="date"
                  id="end_date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-auto h-8 text-xs bg-background/80 border-border/60 rounded-lg"
                />
              </div>
            </div>

            {/* Print Full Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintFullReport}
              disabled={isPrintingReport || isLoading || items.length === 0}
              className="h-9 px-3.5 bg-card/60 hover:bg-accent/60 border-border/70 font-semibold shadow-2xs text-xs"
            >
              {isPrintingReport ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-primary" />
              ) : (
                <Printer className="h-3.5 w-3.5 mr-1.5 text-primary" />
              )}
              Print Report
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Total Cash Outs */}
          <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm shadow-xs rounded-2xl overflow-hidden hover:border-rose-500/30 transition-all">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">
                  Total Cash Outs
                </span>
                <div className="h-7 w-7 rounded-lg bg-rose-500/10 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-9 w-24" /> : formatNumber(summary.total_cash_outs)}
              </div>
            </CardContent>
          </Card>

          {/* Total Amount Paid */}
          <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm shadow-xs rounded-2xl overflow-hidden hover:border-rose-500/30 transition-all">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">
                  Total Amount Paid
                </span>
                <div className="h-7 w-7 rounded-lg bg-rose-500/10 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              <div
                className="text-2xl sm:text-3xl font-black tracking-tight text-rose-600 dark:text-rose-400 truncate"
                title={formatCurrency(summary.total_amount)}
              >
                {isLoading ? <Skeleton className="h-9 w-32" /> : formatCurrency(summary.total_amount)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table Card with Integrated Search & Filter Controls */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-xs rounded-2xl overflow-hidden flex flex-col">
          {/* Filter Bar */}
          <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search voucher, memo, notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-background/80 border-border/60 h-9 text-xs rounded-xl w-full"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Creator / User Dropdown */}
              {canViewUsers && usersList.length > 0 && (
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setPage(1);
                  }}
                  className="flex h-9 w-full sm:w-48 items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Creators</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username}
                    </option>
                  ))}
                </select>
              )}

              {/* Reset Filters */}
              {(search || selectedUserId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setSelectedUserId("");
                    setPage(1);
                  }}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                  title="Reset Search & Filters"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Itemized Table */}
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/25 text-muted-foreground font-semibold">
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap w-12">#</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap w-28">Date</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap w-36">Voucher No</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap w-44">Reason</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap">Recipient / Memo</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap w-36">Created By</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap text-right w-36">Amount</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap text-center w-28">Status</th>
                  <th className="px-3.5 py-3 align-middle whitespace-nowrap text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-6" /></td>
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3.5 py-2.5"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-3.5 py-2.5 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                      <td className="px-3.5 py-2.5 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3.5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileText className="h-9 w-9 text-muted-foreground/30 stroke-1" />
                        <span className="font-semibold text-sm">No cash out records found</span>
                        <p className="text-xs text-muted-foreground/70 max-w-sm">
                          Try adjusting your date range, search query, or creator filter to view records.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      <td className="px-3.5 py-2.5 align-middle font-mono text-muted-foreground/70 whitespace-nowrap">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.cash_out_date)}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle font-mono font-bold text-foreground whitespace-nowrap">
                        {item.cash_out_no}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        >
                          {item.reason}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-2.5 align-middle max-w-xs truncate text-muted-foreground">
                        {item.notes || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle whitespace-nowrap font-medium text-foreground">
                        {item.created_by_name || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-3.5 py-2.5 align-middle text-center whitespace-nowrap">
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          Completed
                        </Badge>
                      </td>
                      <td className="px-3.5 py-2.5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                            onClick={() => setViewingItem(item)}
                            title="View Voucher Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                            onClick={() => handlePrintVoucher(item)}
                            disabled={printingVoucherId === item.id}
                            title="Print Cash Out Voucher"
                          >
                            {printingVoucherId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Printer className="h-3.5 w-3.5 text-primary" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, totalCount)} of {totalCount} records
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2.5 text-xs rounded-lg"
                >
                  Previous
                </Button>
                <span className="font-semibold text-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 px-2.5 text-xs rounded-lg"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* View Cash Out Voucher Modal */}
        <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between pr-4">
                <span className="text-base font-bold">Cash Out Voucher Details</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {viewingItem?.cash_out_no}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Official physical cash withdrawal record
              </DialogDescription>
            </DialogHeader>

            {viewingItem && (
              <div className="space-y-4 py-2 text-xs">
                {/* Amount Highlight Box */}
                <div className="p-4 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                      Amount Withdrawn
                    </span>
                    <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                      {formatCurrency(viewingItem.amount)}
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                    Completed
                  </Badge>
                </div>

                {/* Details Grid */}
                <div className="space-y-2.5 border border-border/60 rounded-xl p-3 bg-muted/20">
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground font-medium">Category / Reason:</span>
                    <span className="font-bold text-foreground">{viewingItem.reason}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground font-medium">Withdrawal Date:</span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(viewingItem.cash_out_date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground font-medium">Created By:</span>
                    <span className="font-semibold text-foreground">
                      {viewingItem.created_by_name || "Authorized Staff"}
                    </span>
                  </div>
                  {viewingItem.notes && (
                    <div className="py-1">
                      <span className="text-muted-foreground font-medium block mb-0.5">
                        Notes / Memo:
                      </span>
                      <p className="text-foreground bg-background/80 p-2 rounded-lg border border-border/40 leading-relaxed">
                        {viewingItem.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingItem(null)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
              {viewingItem && (
                <Button
                  size="sm"
                  onClick={() => handlePrintVoucher(viewingItem)}
                  disabled={printingVoucherId === viewingItem.id}
                  className="rounded-xl text-xs font-semibold"
                >
                  {printingVoucherId === viewingItem.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Print Voucher
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HasPermission>
  );
}
