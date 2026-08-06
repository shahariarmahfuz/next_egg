"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { productService } from "@/services/api";
import { ProductItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";
import { ProductViewModal } from "@/components/products/product-view-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";

import { toast } from "sonner";
import { HardDeleteModal } from "@/components/ui/hard-delete-modal";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [viewingProduct, setViewingProduct] = useState<ProductItem | null>(null);
  const [hardDeletingProduct, setHardDeletingProduct] = useState<ProductItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch Server-Side Paginated & Filtered Products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", page, debouncedSearch, selectedCategory, selectedStatus],
    queryFn: () =>
      productService.getProducts({
        page,
        size: 10,
        search: debouncedSearch || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const products: ProductItem[] = productsData?.data?.items || [];
  const totalPages = productsData?.data?.pages || 1;
  const pageSize = 10;

  // Normal Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (productId: string) => productService.deleteProduct(productId),
    onSuccess: () => {
      toast.success("Product deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete product.";
      toast.error(msg);
    },
  });

  // Hard Delete Mutation
  const hardDeleteMutation = useMutation({
    mutationFn: (productId: string) => productService.hardDeleteProduct(productId),
    onSuccess: () => {
      toast.success("Product and all transaction line items deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      setHardDeletingProduct(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to permanently delete product.";
      toast.error(msg);
    },
  });

  const handleDelete = (product: ProductItem) => {
    deleteMutation.mutate(product.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Inventory Catalog"
        description="Monitor stock balances, unit prices, barcode identifiers, and reorder levels."
        action={
          <HasPermission code="product.create">
            <Button asChild>
              <Link href="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </HasPermission>
        }
      />

      {/* Filter and Server-Side Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Groceries">Groceries</option>
              <option value="Stationery">Stationery</option>
              <option value="General">General</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Compact Products Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Product Code</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Product Name</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Unit</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Current Stock</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Opening Stock Unit Cost</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Selling Price</th>
                <th className="px-3 py-2.5 align-middle w-[110px] whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 align-middle w-[140px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No products found in catalog matching your filter.
                  </td>
                </tr>
              ) : (
                products.map((product, index) => {
                  const isLowStock = product.current_stock <= product.minimum_stock;
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={product.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-primary whitespace-nowrap">
                        {product.product_code}
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground whitespace-nowrap max-w-[220px] truncate" title={product.name}>
                        {product.name}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs uppercase font-medium whitespace-nowrap text-muted-foreground">
                        {product.unit}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-bold ${
                              isLowStock ? "text-amber-500" : "text-emerald-500"
                            }`}
                          >
                            {product.current_stock}
                          </span>
                          {isLowStock && (
                            <span title={`Low Stock! Minimum threshold is ${product.minimum_stock}`}>
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 inline shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(product.opening_stock_unit_cost)}
                      </td>
                      <td className="px-3 py-2 align-middle text-xs font-semibold text-primary whitespace-nowrap">
                        {formatCurrency(product.selling_price)}
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge
                          variant={product.status === "active" ? "success" : "secondary"}
                          className="capitalize text-[10px] py-0 px-2 h-5"
                        >
                          {product.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewingProduct(product)}
                          title="View Product Profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <HasPermission code="product.edit">
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit Product">
                            <Link href={`/products/${product.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </HasPermission>
                        <HasPermission code="product.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(product)}
                            title="Normal Delete (Blocked if transactions exist)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 dark:text-rose-500 hover:bg-rose-500/10"
                            onClick={() => setHardDeletingProduct(product)}
                            title="Hard Delete (Permanently remove product & all transaction line items)"
                          >
                            <Trash2 className="h-3.5 w-3.5 fill-rose-600/20" />
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
          <div className="flex items-center justify-between p-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
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
      <ProductViewModal
        product={viewingProduct}
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
      />

      {/* Controlled Hard Delete Confirmation Modal */}
      <HardDeleteModal
        isOpen={!!hardDeletingProduct}
        onClose={() => setHardDeletingProduct(null)}
        onConfirm={async () => {
          if (hardDeletingProduct) {
            await hardDeleteMutation.mutateAsync(hardDeletingProduct.id);
          }
        }}
        entityType="Product"
        entityName={`${hardDeletingProduct?.product_code || ""} - ${hardDeletingProduct?.name || ""}`}
        affectedItems={[
          "All sale invoice line items for this product",
          "All purchase order line items for this product",
          "All sale return line items",
          "All product return line items",
        ]}
        isDeleting={hardDeleteMutation.isPending}
      />
    </div>
  );
}
