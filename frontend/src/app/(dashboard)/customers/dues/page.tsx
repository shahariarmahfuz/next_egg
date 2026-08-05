"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Search,
  Users,
  Eye,
  ArrowLeft,
  DollarSign,
} from "lucide-react";
import { customerService } from "@/services/api";
import { CustomerItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { CustomerViewModal } from "@/components/customers/customer-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

export default function CustomerDueListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch Customers with current_balance > 0 ONLY
  const { data: duesData, isLoading } = useQuery({
    queryKey: ["customer-dues", page, debouncedSearch],
    queryFn: () =>
      customerService.getCustomerDues({
        page,
        size: 15,
        search: debouncedSearch || undefined,
      }),
  });

  const dueCustomers: CustomerItem[] = duesData?.data?.items || [];
  const totalPages = duesData?.data?.pages || 1;
  const pageSize = 15;
  const totalDueSum = dueCustomers.reduce((acc, c) => acc + c.current_balance, 0);

  return (
    <HasPermission code="customer.due.view">
      <div className="space-y-6">
        <PageHeader
          title="Customer Outstanding Due List"
          description="Monitors accounts receivable with active due balances greater than zero ($0.00)."
          action={
            <Button asChild variant="outline">
              <Link href="/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Customers
              </Link>
            </Button>
          }
        />

        {/* Due Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card md:col-span-2">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">
                  Active Debtors Count (Current Page)
                </span>
                <span className="text-2xl font-extrabold text-foreground">
                  {dueCustomers.length} Client(s)
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">
                  Page Total Receivable Due
                </span>
                <span className="text-2xl font-extrabold text-amber-500 ">
                  {formatCurrency(totalDueSum)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Server-side Search */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search due list by customer code, name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer Due List Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Code</th>
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Customer Name</th>
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
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : dueCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No customer accounts currently have an outstanding due balance greater than $0.00.
                    </td>
                  </tr>
                ) : (
                  dueCustomers.map((customer, index) => {
                    const serialNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={customer.id} className="hover:bg-accent/40 transition-colors h-10">
                        <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                          {serialNumber}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                          {customer.customer_code}
                        </td>
                        <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap">
                          {customer.name}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                          {customer.phone || "-"}
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap font-medium">
                          {formatCurrency(customer.opening_balance)}
                        </td>
                        <td className="px-3 py-2 align-middle font-semibold text-amber-500 whitespace-nowrap">
                          {formatCurrency(customer.current_balance)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewingCustomer(customer)}
                            title="View Customer Profile"
                          >
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

        {/* View Modal */}
        <CustomerViewModal
          customer={viewingCustomer}
          isOpen={!!viewingCustomer}
          onClose={() => setViewingCustomer(null)}
        />
      </div>
    </HasPermission>
  );
}
