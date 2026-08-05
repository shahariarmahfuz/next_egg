"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { customerService } from "@/services/api";
import { CustomerForm, CustomerFormValues } from "@/components/customers/customer-form";
import { HasPermission } from "@/providers/auth-provider";

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      customerService.createCustomer({
        name: values.name,
        phone: values.phone || undefined,
        customer_code: values.customer_code || undefined,
        address: values.address || undefined,
        opening_balance: values.opening_balance ?? 0,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-dues"] });
      toast.success("Customer added successfully.");
      router.push("/customers");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to add customer.";
      toast.error(msg);
    },
  });

  const handleSubmit = async (values: CustomerFormValues) => {
    await createMutation.mutateAsync(values);
  };

  return (
    <HasPermission code="customer.create">
      <div className="py-4">
        <CustomerForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/customers")}
        />
      </div>
    </HasPermission>
  );
}
