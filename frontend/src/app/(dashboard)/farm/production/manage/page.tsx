"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Search,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  RotateCw,
  X,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  Building2,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { farmService } from "@/services/api";
import { FarmBalanceItem, FarmProductionItem, FarmProductionUpdatePayload } from "@/types";
import { formatDate } from "@/utils/formatters";
import { sanitizeNumericInput } from "@/utils/numeric-sanitizer";

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

export default function ManageProductionPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [farmId, setFarmId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals state
  const [viewingItem, setViewingItem] = useState<FarmProductionItem | null>(null);
  const [editingItem, setEditingItem] = useState<FarmProductionItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<FarmProductionItem | null>(null);

  // Edit form state
  const [editFarmId, setEditFarmId] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editTrayQuantity, setEditTrayQuantity] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editError, setEditError] = useState<string>("");

  // Query: Farms list for dropdown
  const { data: farmsData } = useQuery({
    queryKey: ["farms-list"],
    queryFn: () => farmService.getFarms(),
  });
  const farms: FarmBalanceItem[] = farmsData?.data || [];

  // Query: Paginated production records
  const {
    data: responseData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["farm-production-manage", page, pageSize, farmId, startDate, endDate, search],
    queryFn: () =>
      farmService.getProductions({
        page,
        size: pageSize,
        farm_id: farmId !== "all" ? farmId : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: search.trim() || undefined,
      }),
    enabled: hasPermission(["farm.production.view", "production.view"]),
  });

  const productions: FarmProductionItem[] = responseData?.data?.items || [];
  const totalItems = responseData?.data?.total || 0;
  const totalPages = responseData?.data?.pages || Math.ceil(totalItems / pageSize) || 1;

  // Mutation: Update production record
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FarmProductionUpdatePayload }) =>
      farmService.updateProduction(id, payload),
    onSuccess: () => {
      toast.success("Production record updated successfully.");
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["farm-production-manage"] });
      queryClient.invalidateQueries({ queryKey: ["farms-list"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to update production record.";
      setEditError(msg);
      toast.error(msg);
    },
  });

  // Mutation: Delete production record
  const deleteMutation = useMutation({
    mutationFn: (id: string) => farmService.deleteProduction(id),
    onSuccess: () => {
      toast.success("Production record deleted successfully.");
      setDeletingItem(null);
      queryClient.invalidateQueries({ queryKey: ["farm-production-manage"] });
      queryClient.invalidateQueries({ queryKey: ["farms-list"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to delete production record.";
      toast.error(msg);
    },
  });

  const openEditModal = (item: FarmProductionItem) => {
    setEditingItem(item);
    setEditFarmId(item.farm_id);
    setEditDate(item.production_date ? item.production_date.split("T")[0] : "");
    setEditTrayQuantity(String(item.tray_quantity));
    setEditNotes(item.notes || item.note || "");
    setEditError("");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const qty = parseFloat(sanitizeNumericInput(editTrayQuantity));
    if (isNaN(qty) || qty <= 0) {
      setEditError("Production tray quantity must be greater than 0.");
      return;
    }

    if (!editDate) {
      setEditError("Production date is required.");
      return;
    }

    setEditError("");
    updateMutation.mutate({
      id: editingItem.id,
      payload: {
        farm_id: editFarmId || undefined,
        production_date: editDate,
        tray_quantity: qty,
        notes: editNotes.trim() ? editNotes.trim() : undefined,
      },
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id);
  };

  const handleClearFilters = () => {
    setFarmId("all");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters = farmId !== "all" || Boolean(search) || Boolean(startDate) || Boolean(endDate);

  const startItemIdx = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItemIdx = Math.min(page * pageSize, totalItems);
  const totalTraysOnPage = productions.reduce((sum, item) => sum + (Number(item.tray_quantity) || 0), 0);

  return (
    <HasPermission
      code={["farm.production.view", "production.view"]}
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Production Management.
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Manage Production"
            description="Audit daily farm harvests, filter production history, update entries, and track tray yields."
          />

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs shadow-sm">
              <Link href="/farm/report">
                <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Production Report</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 gap-1.5 text-xs shadow-sm">
              <Link href="/farm/production">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Production</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="glass-card shadow-sm border">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
              {/* Farm Dropdown */}
              <div className="sm:col-span-1 md:col-span-3">
                <Select
                  value={farmId}
                  onValueChange={(val) => {
                    setFarmId(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Farms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Farms</SelectItem>
                    {farms.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search text */}
              <div className="sm:col-span-1 md:col-span-3 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes or farm..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Start Date */}
              <div className="sm:col-span-1 md:col-span-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                    title="From Date"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="sm:col-span-1 md:col-span-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                    title="To Date"
                  />
                </div>
              </div>

              {/* Page Size & Refresh Actions */}
              <div className="sm:col-span-2 md:col-span-2 flex items-center gap-1.5 justify-end">
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[75px] text-xs">
                    <SelectValue placeholder="25" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((sz) => (
                      <SelectItem key={sz} value={String(sz)} className="text-xs">
                        {sz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="h-9 w-9"
                  title="Refresh"
                >
                  <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-medium">
                  Total Records: {totalItems}
                </Badge>
                <Badge variant="outline" className="font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  Page Trays: {totalTraysOnPage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </Badge>
              </div>
              {hasActiveFilters && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  Filtered view active
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="glass-card shadow-sm border overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">SL</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Farm</th>
                    <th className="py-3 px-4 text-right">Production (Trays)</th>
                    <th className="py-3 px-4">Notes / Info</th>
                    <th className="py-3 px-4 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs">Loading production records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : productions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                          <span className="text-sm font-medium">No production records found</span>
                          <span className="text-xs text-muted-foreground">
                            {hasActiveFilters
                              ? "Try adjusting your filters or date range."
                              : "Get started by recording daily production."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    productions.map((item, idx) => {
                      const sl = (page - 1) * pageSize + idx + 1;
                      const farmDisplay = item.farm_name || farms.find((f) => f.id === item.farm_id)?.name || "Unknown Farm";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/40 transition-colors group"
                        >
                          {/* SL */}
                          <td className="py-3 px-4 text-center font-mono text-muted-foreground text-[11px]">
                            {sl}
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 font-medium whitespace-nowrap">
                            {formatDate(item.production_date)}
                          </td>

                          {/* Farm */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[180px]">{farmDisplay}</span>
                            </div>
                          </td>

                          {/* Production Trays */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            {Number(item.tray_quantity).toLocaleString(undefined, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{" "}
                            <span className="text-[10px] font-normal text-muted-foreground">trays</span>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-4 max-w-[240px]">
                            <span className="text-muted-foreground block truncate">
                              {item.notes || item.note || "—"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* View Action */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingItem(item)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {/* Edit Action */}
                              {hasPermission(["farm.production.edit", "production.edit"]) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(item)}
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Edit production"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Delete Action */}
                              {hasPermission(["farm.production.delete", "production.delete"]) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingItem(item)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  title="Delete production"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-muted/10 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startItemIdx}</span>–
                <span className="font-semibold text-foreground">{endItemIdx}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems}</span> records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && p - prevPage > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                          <Button
                            variant={page === p ? "default" : "outline"}
                            size="icon"
                            onClick={() => setPage(p)}
                            className="h-8 w-8 text-xs"
                          >
                            {p}
                          </Button>
                        </div>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Details Modal */}
        <Dialog open={Boolean(viewingItem)} onOpenChange={(open) => !open && setViewingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5 text-amber-500" />
                <span>Production Record Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detailed harvest record information and timestamp audit.
              </DialogDescription>
            </DialogHeader>

            {viewingItem && (
              <div className="space-y-3 py-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Farm Name</span>
                    <span className="font-semibold text-sm text-foreground">
                      {viewingItem.farm_name || farms.find((f) => f.id === viewingItem.farm_id)?.name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Harvest Trays</span>
                    <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                      {Number(viewingItem.tray_quantity).toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{" "}
                      trays
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Production Date</span>
                    <span className="font-medium">{formatDate(viewingItem.production_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">System Record ID</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{viewingItem.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created At</span>
                    <span className="font-mono text-[11px]">
                      {new Date(viewingItem.created_at).toLocaleString()}
                    </span>
                  </div>
                  {viewingItem.updated_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span className="font-mono text-[11px]">
                        {new Date(viewingItem.updated_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {(viewingItem.notes || viewingItem.note) && (
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <span className="text-muted-foreground font-semibold text-[11px] block">Notes:</span>
                    <p className="text-foreground">{viewingItem.notes || viewingItem.note}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                <span>Edit Production Record</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update harvest quantity or date. Changing quantity will automatically recalculate farm available tray stock.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              {editError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
                  {editError}
                </div>
              )}

              {/* Farm Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Farm</Label>
                <Select value={editFarmId} onValueChange={setEditFarmId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent>
                    {farms.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">
                        {f.name} (Available: {f.available_tray ?? 0} trays)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs">Production Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Tray Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tray Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="e.g. 50"
                  value={editTrayQuantity}
                  onChange={(e) => setEditTrayQuantity(e.target.value)}
                  required
                  className="h-9 text-xs font-medium"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (Optional)</Label>
                <Textarea
                  placeholder="Any harvest observations..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="text-xs resize-none h-20"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMutation.isPending}
                  className="min-w-[80px]"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-base font-bold">Delete Production Record</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-2">
                Are you sure you want to delete this harvest of{" "}
                <strong className="text-foreground font-semibold">
                  {deletingItem?.tray_quantity} trays
                </strong>{" "}
                from{" "}
                <strong className="text-foreground font-semibold">
                  {deletingItem?.farm_name || farms.find((f) => f.id === deletingItem?.farm_id)?.name || "Farm"}
                </strong>{" "}
                on{" "}
                <strong className="text-foreground font-semibold">
                  {deletingItem?.production_date ? formatDate(deletingItem.production_date) : ""}
                </strong>
                ?
                <br />
                <br />
                <span className="text-destructive font-medium">
                  Note: If subsequent deliveries rely on these trays, deleting this harvest will be blocked to maintain stock integrity.
                </span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingItem(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="min-w-[90px]"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HasPermission>
  );
}
