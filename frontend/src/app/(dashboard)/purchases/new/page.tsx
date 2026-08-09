"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productService, purchaseService, supplierService } from "@/services/api";
import { PurchaseForm, PurchaseFormValues } from "@/components/purchases/purchase-form";
import { HasPermission } from "@/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewPurchasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch Suppliers
  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ["all-suppliers-dropdown"],
    queryFn: () => supplierService.getSuppliers({ size: 200 }),
  });

  // Fetch Products
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["all-products-dropdown"],
    queryFn: () => productService.getProducts({ size: 500 }),
  });

  const suppliers = suppliersData?.data?.items || [];
  const products = productsData?.data?.items || [];

  const createMutation = useMutation({
    mutationFn: (values: PurchaseFormValues) =>
      purchaseService.createPurchase({
        ...values,
        purchase_no: values.purchase_no || undefined,
        invoice_no: values.invoice_no || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Purchase added successfully.");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to add purchase.";
      toast.error(msg);
    },
  });

  const handleSubmit = async (values: PurchaseFormValues) => {
    await createMutation.mutateAsync(values);
  };

  if (loadingSuppliers || loadingProducts) {
    return (
      <div className="w-full py-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  return (
    <HasPermission code="purchase.create">
      <div className="py-4">
        <PurchaseForm
          suppliers={suppliers}
          products={products}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/purchases")}
        />
      </div>
    </HasPermission>
  );
}
