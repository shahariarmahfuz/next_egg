"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye } from "lucide-react";
import { saleReturnService } from "@/services/api";
import { SaleReturnItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/formatters";

export default function SaleReturnsReportPage() {
  const today = new Date().toLocaleDateString('en-CA');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [viewingReturn, setViewingReturn] = useState<SaleReturnItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ["sale-returns-reports", page, debouncedSearch, startDate, endDate],
    queryFn: () =>
      saleReturnService.getSaleReturns({
        page,
        size: 15,
        search: debouncedSearch || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  const returns: SaleReturnItem[] = returnsData?.data?.items || [];
  const totalPages = returnsData?.data?.pages || 1;
  const pageSize = 15;
  const aggregate = returnsData?.data?.aggregate || { total_amount: 0, refunded_amount: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader title="Sale Returns Report" description="Comprehensive report of all sale returns." />
        <div className="flex items-center space-x-3 bg-card p-2 rounded-lg border shadow-sm">
          <div className="flex items-center space-x-2">
            <Label htmlFor="start_date" className="text-xs">From</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="end_date" className="text-xs">To</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="glass-card border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Total Return Amount</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Refunded</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reference or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-background w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 align-middle font-medium w-[60px] text-center whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Return No</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Customer</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Grand Total</th>
                <th className="px-3 py-2.5 align-middle font-medium text-left whitespace-nowrap">Refunded</th>
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
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No sale returns found matching your criteria.
                  </td>
                </tr>
              ) : (
                returns.map((ret, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={ret.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">{serialNumber}</td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">{ret.return_no}</td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[200px] truncate" title={ret.customer?.name || "Walk-in Cash Customer"}>{ret.customer?.name || "Walk-in Cash Customer"}</td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                        -
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

    </div>
  );
}
