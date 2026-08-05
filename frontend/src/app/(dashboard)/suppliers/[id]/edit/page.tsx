"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierService } from "@/services/api";
import { SupplierForm, SupplierFormValues } from "@/components/suppliers/supplier-form";
import { HasPermission } from "@/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch supplier details by ID
  const { data: supplierData, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => supplierService.getSupplierById(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      supplierService.updateSupplier(id, {
        name: values.name,
        phone: values.phone || undefined,
        address: values.address || undefined,
        current_balance: values.current_balance,
        status: values.status,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      router.push("/suppliers");
    },
  });

  const handleSubmit = async (values: SupplierFormValues) => {
    await updateMutation.mutateAsync(values);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const supplier = supplierData?.data;
  if (!supplier) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Supplier record not found or has been removed.
      </div>
    );
  }

  return (
    <HasPermission code="supplier.edit">
      <div className="py-4">
        <SupplierForm
          initialData={supplier}
          isEdit={true}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/suppliers")}
        />
      </div>
    </HasPermission>
  );
}
