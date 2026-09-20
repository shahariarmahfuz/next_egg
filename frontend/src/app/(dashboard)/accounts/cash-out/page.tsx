"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  BookOpen,
  History,
  RotateCw,
  CheckCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { useSettingsStore } from "@/store/settings";
import { cashOutService } from "@/services/api";
import { sanitizeNumericInput } from "@/utils/numeric-sanitizer";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { CashOutItem } from "@/types";

// Quick suggestion chips for common withdrawal reasons
const QUICK_REASONS = [
  "Owner Withdrawal",
  "Personal Cash Withdrawal",
  "Cash Transfer",
  "Proprietor Drawings",
  "Emergency Cash Out",
];

export default function CashOutPage() {
  const { user } = useAuth();
  const { settings } = useSettingsStore();
  const queryClient = useQueryClient();

  // Helper to get today's date in YYYY-MM-DD
  const getTodayISO = () => {
    try {
      const tz = settings.timezone || "UTC";
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  const [date, setDate] = useState<string>(getTodayISO());
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Query recent cash outs for audit and immediate visual feedback
  const {
    data: recentData,
    isLoading: isLoadingRecent,
    refetch: refetchRecent,
    isRefetching,
  } = useQuery({
    queryKey: ["recent-cash-outs"],
    queryFn: () => cashOutService.getCashOuts({ page: 1, size: 10 }),
    retry: 1,
  });

  const recentItems: CashOutItem[] = recentData?.data?.items || [];

  // Create Cash Out mutation
  const createMutation = useMutation({
    mutationFn: (payload: { amount: number; cash_out_date: string; reason: string; notes?: string }) =>
      cashOutService.createCashOut(payload),
    onSuccess: (res) => {
      // Invalidate queries so Cash Book and list update immediately
      queryClient.invalidateQueries({ queryKey: ["recent-cash-outs"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });

      const voucherNo = res.data.cash_out_no;
      toast.success(`Cash Out voucher ${voucherNo} recorded successfully!`);

      // Reset form fields while staying on the page (do NOT redirect)
      setAmount("");
      setReason("");
      setNote("");
      setErrorMsg("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to record cash out transaction.";
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize Bengali digits and ensure positive numeric input
    const sanitized = sanitizeNumericInput(e.target.value, false);
    setAmount(sanitized);
    if (errorMsg) setErrorMsg("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      const err = "Amount must be greater than 0.";
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    if (!reason.trim()) {
      const err = "Please specify a reason or description for the cash out.";
      setErrorMsg(err);
      toast.error(err);
      return;
    }

    // Prepare ISO datetime for the selected date
    const isoDateTime = new Date(`${date}T12:00:00Z`).toISOString();

    createMutation.mutate({
      amount: numAmount,
      cash_out_date: isoDateTime,
      reason: reason.trim(),
      notes: note.trim() || undefined,
    });
  };

  return (
    <HasPermission
      code="accounts.cash_book.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to access the Cash Out module.
        </div>
      }
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Cash Out"
            description="Record physical cash withdrawals that are not expenses (e.g. Owner/Personal withdrawal, cash transfers)."
          />

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs shadow-sm">
              <Link href="/accounts/cash-book">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>View Cash Book</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Grid: Form on Left/Top, History on Right/Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cash Out Entry Form */}
          <Card className="glass-card lg:col-span-5 shadow-sm">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Record Cash Out</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Reduces daily Cash Book balance without affecting Expenses or Profit.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* 1. Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="cash-out-date" className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Date</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cash-out-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                {/* 2. Amount */}
                <div className="space-y-1.5">
                  <Label htmlFor="cash-out-amount" className="text-xs font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Amount ({settings.currency?.symbol || "৳"})</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cash-out-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    required
                    className="h-10 text-sm font-semibold tracking-wide"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Accepts English and Bengali digits. Decimals supported.
                  </span>
                </div>

                {/* 3. Reason / Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="cash-out-reason" className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Reason / Description</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cash-out-reason"
                    type="text"
                    placeholder="e.g. Owner Withdrawal"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />

                  {/* Suggestion Chips */}
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {QUICK_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className="text-[10.5px] px-2 py-0.5 rounded-full border border-border bg-muted/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Note (Optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="cash-out-note" className="text-xs font-medium text-muted-foreground">
                    Note (Optional)
                  </Label>
                  <Textarea
                    id="cash-out-note"
                    rows={2}
                    placeholder="Additional context or remarks..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="text-xs resize-none"
                  />
                </div>

                {/* 5. Save Button */}
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full h-10 gap-2 text-xs font-semibold shadow-sm mt-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Cash Out...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Save Cash Out</span>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Cash Out Activity */}
          <Card className="glass-card lg:col-span-7 shadow-sm flex flex-col">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span>Recent Cash Out Vouchers</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest cash withdrawals recorded in the system
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchRecent()}
                disabled={isRefetching || isLoadingRecent}
                className="h-8 px-2 text-xs text-muted-foreground"
                title="Refresh history"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRefetching || isLoadingRecent ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingRecent ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        <span>Loading recent cash out entries...</span>
                      </td>
                    </tr>
                  ) : recentItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                        No cash out transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentItems.map((item: CashOutItem) => (
                      <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-primary whitespace-nowrap">
                          {item.cash_out_no}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(item.cash_out_date)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-foreground">{item.reason}</div>
                          {item.notes && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {item.created_by_name || "User"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </HasPermission>
  );
}
