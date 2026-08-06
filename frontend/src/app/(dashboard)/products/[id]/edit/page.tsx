"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/api";
import { ProductForm, ProductFormValues } from "@/components/products/product-form";
import { HasPermission } from "@/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productService.getProductById(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProductFormValues) =>
      productService.updateProduct(id, {
        name: values.name,
        category: values.category || undefined,
        brand: values.brand || undefined,
        barcode: values.barcode || undefined,
        unit: values.unit,
        opening_stock_unit_cost: values.opening_stock_unit_cost,
        selling_price: values.selling_price,
        minimum_stock: values.minimum_stock,
        status: values.status,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      router.push("/products");
    },
  });

  const handleSubmit = async (values: ProductFormValues) => {
    await updateMutation.mutateAsync(values);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  const product = productData?.data;
  if (!product) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Product not found or has been deleted.
      </div>
    );
  }

  return (
    <HasPermission code="product.edit">
      <div className="py-4">
        <ProductForm
          initialData={product}
          isEdit={true}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/products")}
        />
      </div>
    </HasPermission>
  );
}
