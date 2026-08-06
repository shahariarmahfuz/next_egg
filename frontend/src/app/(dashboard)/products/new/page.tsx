"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productService } from "@/services/api";
import { ProductForm, ProductFormValues } from "@/components/products/product-form";
import { HasPermission } from "@/providers/auth-provider";

export default function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) =>
      productService.createProduct({
        name: values.name,
        unit: values.unit,
        opening_stock_unit_cost: values.opening_stock_unit_cost,
        selling_price: values.selling_price,
        product_code: values.product_code || undefined,
        category: values.category || undefined,
        brand: values.brand || undefined,
        barcode: values.barcode || undefined,
        opening_stock: values.opening_stock,
        minimum_stock: values.minimum_stock,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Product added successfully.");
      router.push("/products");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to add product.";
      toast.error(msg);
    },
  });

  const handleSubmit = async (values: ProductFormValues) => {
    await createMutation.mutateAsync(values);
  };

  return (
    <HasPermission code="product.create">
      <div className="py-4">
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/products")}
        />
      </div>
    </HasPermission>
  );
}
