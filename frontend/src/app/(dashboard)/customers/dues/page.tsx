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
  Printer,
  Loader2,
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
import { PrintableDueList } from "@/components/customers/printable-due-list";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

export default function CustomerDueListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState<CustomerItem[]>([]);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch Customers with current_balance > 0 ONLY
  const { data: duesData, isLoading } = useQuery({
    queryKey: ["customer-dues", page, pageSize, debouncedSearch],
    queryFn: () =>
      customerService.getCustomerDues({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["customer-dues-summary", debouncedSearch],
    queryFn: () => customerService.getCustomerDuesSummary({ search: debouncedSearch || undefined }),
  });

  const dueCustomers: CustomerItem[] = duesData?.data?.items || [];
  const totalPages = duesData?.data?.pages || 1;
  const summary = summaryData?.data;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const res = await customerService.getCustomerDues({
        page: 1,
        size: 100000,
        search: debouncedSearch || undefined,
      });
      setPrintData(res.data.items);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    } catch (error) {
      console.error("Failed to fetch print data", error);
      setIsPrinting(false);
    }
  };

  return (
    <HasPermission code="customer.due.view">
      <div className="space-y-6 print:hidden">
        <PageHeader
          title="Customer Outstanding Due List"
          description="Monitors accounts receivable with active due balances greater than zero ($0.00)."
          action={
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Print Due List
              </Button>
              <Button asChild variant="outline">
                <Link href="/customers">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to All Customers
                </Link>
              </Button>
            </div>
          }
        />

        {/* Due Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card md:col-span-2">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">
                  Total Due Customers
                </span>
                <span className="text-2xl font-extrabold text-foreground">
                  {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : `${summary?.total_customers || 0} Client(s)`}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">
                  Total Customer Due
                </span>
                <span className="text-2xl font-extrabold text-amber-500 ">
                  {isLoadingSummary ? <Skeleton className="h-8 w-32" /> : formatCurrency(summary?.total_amount || 0)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Server-side Search and Pagination Size */}
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search due list by customer code, name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
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

      {/* Print View */}
      {isPrinting && (
        <PrintableDueList
          customers={printData}
          searchQuery={debouncedSearch}
          totalCustomers={summary?.total_customers || 0}
          totalAmount={summary?.total_amount || 0}
        />
      )}
    </HasPermission>
  );
}
