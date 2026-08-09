"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye } from "lucide-react";
import { supplierPaymentService } from "@/services/api";
import { SupplierPaymentItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { SupplierPaymentViewModal } from "@/components/supplier-payments/supplier-payment-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function SupplierPaymentsReportPage() {
  const today = new Date().toLocaleDateString('en-CA');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [viewingPayment, setViewingPayment] = useState<SupplierPaymentItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ["supplier-payments-reports", page, debouncedSearch, paymentMethod, startDate, endDate],
    queryFn: () =>
      supplierPaymentService.getSupplierPayments({
        page,
        size: 15,
        search: debouncedSearch || undefined,
        payment_method: paymentMethod !== "all" ? paymentMethod : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      }),
  });

  const payments: SupplierPaymentItem[] = paymentsData?.data?.items || [];
  const totalPages = paymentsData?.data?.pages || 1;
  const pageSize = 15;
  const aggregate = paymentsData?.data?.aggregate || { total_amount: 0, paid_amount: 0, due_amount: 0 };

  const getMethodBadge = (method: string) => {
    switch (method?.toLowerCase()) {
      case "cash":
        return <Badge className="bg-emerald-500/10 text-emerald-600">Cash</Badge>;
      case "bank":
        return <Badge className="bg-blue-500/10 text-blue-600">Bank Transfer</Badge>;
      case "card":
        return <Badge className="bg-purple-500/10 text-purple-600">Card</Badge>;
      case "mobile_money":
        return <Badge className="bg-orange-500/10 text-orange-600">Mobile Money</Badge>;
      case "cheque":
        return <Badge className="bg-amber-500/10 text-amber-600">Cheque</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{method?.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader title="Supplier Payments Report" description="Comprehensive report of all supplier payments." />
        <div className="flex items-center space-x-3 bg-card p-2 rounded-lg border shadow-sm">
          <div className="flex items-center space-x-2">
            <Label htmlFor="start_date" className="text-xs">From</Label>
            <Input type="date" id="start_date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto h-8 text-xs" />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="end_date" className="text-xs">To</Label>
            <Input type="date" id="end_date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">Total Paid</div>
            <div className="text-xl font-extrabold text-rose-500">{formatCurrency(aggregate.paid_amount || aggregate.total_amount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search voucher or supplier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-background w-full"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              className="flex h-10 w-full sm:w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 align-middle font-medium w-[60px] text-center whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Voucher No</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Supplier</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Amount</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Method</th>
                <th className="px-3 py-2.5 align-middle font-medium text-right whitespace-nowrap w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No supplier payments found matching your criteria.
                  </td>
                </tr>
              ) : (
                payments.map((payment, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={payment.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">{serialNumber}</td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">{payment.payment_no || '-'}</td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">{formatDate(payment.payment_date)}</td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={payment.supplier?.name}>{payment.supplier?.name}</td>
                      <td className="px-3 py-2 align-middle font-semibold text-rose-500 whitespace-nowrap">{formatCurrency(payment.amount)}</td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">{getMethodBadge(payment.payment_method)}</td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingPayment(payment)} title="View Payment Details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {viewingPayment && (
        <SupplierPaymentViewModal payment={viewingPayment} isOpen={!!viewingPayment} onClose={() => setViewingPayment(null)} />
      )}
    </div>
  );
}
