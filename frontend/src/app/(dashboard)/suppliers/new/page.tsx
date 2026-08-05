"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supplierService } from "@/services/api";
import { SupplierForm, SupplierFormValues } from "@/components/suppliers/supplier-form";
import { HasPermission } from "@/providers/auth-provider";

export default function NewSupplierPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      supplierService.createSupplier({
        name: values.name,
        phone: values.phone || undefined,
        supplier_code: values.supplier_code || undefined,
        address: values.address || undefined,
        opening_balance: values.opening_balance ?? 0,
        status: values.status,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier added successfully.");
      router.push("/suppliers");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to add supplier.";
      toast.error(msg);
    },
  });

  const handleSubmit = async (values: SupplierFormValues) => {
    await createMutation.mutateAsync(values);
  };

  return (
    <HasPermission code="supplier.create">
      <div className="py-4">
        <SupplierForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/suppliers")}
        />
      </div>
    </HasPermission>
  );
}
