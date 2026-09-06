"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Truck,
  ArrowLeft,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FarmTransactionForm } from "@/components/farm/farm-transaction-form";
import { FarmViewModal } from "@/components/farm/farm-view-modal";
import { farmService } from "@/services/api";
import { FarmTransactionItem } from "@/types";
import { toast } from "sonner";

export default function FarmDeliveryPage() {
  const [history, setHistory] = useState<FarmTransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewingTxn, setViewingTxn] = useState<FarmTransactionItem | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await farmService.getDeliveryHistory({
        page,
        size: pageSize,
      });
      if (res.success && res.data) {
        setHistory(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load delivery history:", err);
      toast.error("Failed to load delivery history");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <Link href="/farm">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Record Farm Delivery</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Transfer farm stock to shop, retail point, or distribution hub (Non-Financial)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/farm/report">
            <Button variant="outline" size="sm" className="text-xs">
              Farm Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Delivery Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center space-x-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span>New Delivery Entry</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FarmTransactionForm
                type="DELIVERY"
                onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Recent Delivery History */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Recent Delivery Records
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Showing latest farm dispatches logged ({total} total)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchHistory()}
                disabled={loading}
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3 text-right">Trays</th>
                      <th className="px-4 py-3 text-right text-blue-600">Total Quantity</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="p-3">
                            <Skeleton className="h-6 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No delivery entries recorded yet. Use the form on the left to record delivery.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {item.transaction_date ? format(new Date(item.transaction_date), "dd MMM yyyy") : "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="flex items-center space-x-1.5">
                              <span>{item.product_name}</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500/30 text-amber-600 bg-amber-500/10">
                                FARM
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {item.destination ? (
                              <div className="flex items-center space-x-1 text-blue-600 font-semibold">
                                <MapPin className="h-3 w-3" />
                                <span>{item.destination}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {item.tray_count ? `${item.tray_count} trays` : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">
                            -{item.quantity} {item.unit || "units"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={item.notes || undefined}>
                            {item.notes || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setViewingTxn(item)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="h-7 text-xs px-2"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="h-7 text-xs px-2"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <FarmViewModal
        transaction={viewingTxn}
        isOpen={!!viewingTxn}
        onClose={() => setViewingTxn(null)}
      />
    </div>
  );
}
