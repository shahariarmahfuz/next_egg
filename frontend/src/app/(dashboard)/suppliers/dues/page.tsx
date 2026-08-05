"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Truck,
  AlertCircle,
  Eye,
  Edit,
  ArrowLeft,
} from "lucide-react";
import { supplierService } from "@/services/api";
import { SupplierItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { SupplierViewModal } from "@/components/suppliers/supplier-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

export default function SupplierDuesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewingSupplier, setViewingSupplier] = useState<SupplierItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch Server-Side Paginated Supplier Dues (where current_balance > 0)
  const { data: duesData, isLoading } = useQuery({
    queryKey: ["supplier-dues", page, debouncedSearch],
    queryFn: () =>
      supplierService.getSupplierDues({
        page,
        size: 10,
        search: debouncedSearch || undefined,
      }),
  });

  const suppliers: SupplierItem[] = duesData?.data?.items || [];
  const totalPages = duesData?.data?.pages || 1;
  const pageSize = 10;

  // Calculate sum of page dues for quick overview
  const totalPageDues = suppliers.reduce((sum, s) => sum + s.current_balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Due List"
        description="Filter and track all supplier accounts with active outstanding payable balances (> $0)."
        action={
          <Button asChild variant="outline">
            <Link href="/suppliers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Suppliers Directory
            </Link>
          </Button>
        }
      />

      {/* Summary Card & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card md:col-span-1 border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Total Page Dues</span>
              <span className="text-2xl font-extrabold text-amber-500">
                {formatCurrency(totalPageDues)}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card md:col-span-2">
          <CardContent className="p-4 flex items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search due suppliers by name, code, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Dues Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier Code</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Supplier Name</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Company</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Phone</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Opening Due</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Current Outstanding Due</th>
                <th className="px-3 py-2.5 align-middle w-[120px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No outstanding supplier dues found matching your query.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={supplier.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {supplier.supplier_code}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap">
                        {supplier.name}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {supplier.company_name || "-"}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                        {supplier.phone || "-"}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap font-medium">
                        {formatCurrency(supplier.opening_balance)}
                      </td>
                      <td className="px-3 py-2 align-middle font-semibold text-amber-500 whitespace-nowrap">
                        {formatCurrency(supplier.current_balance)}
                      </td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingSupplier(supplier)}
                          title="View Supplier Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <HasPermission code="supplier.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Supplier">
                            <Link href={`/suppliers/${supplier.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Quick View Modal */}
      <SupplierViewModal
        supplier={viewingSupplier}
        isOpen={!!viewingSupplier}
        onClose={() => setViewingSupplier(null)}
      />
    </div>
  );
}
