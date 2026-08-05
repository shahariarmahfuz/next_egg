"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/api";
import { CustomerForm, CustomerFormValues } from "@/components/customers/customer-form";
import { HasPermission } from "@/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: customerData, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerService.getCustomerById(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      customerService.updateCustomer(id, {
        name: values.name,
        phone: values.phone || undefined,
        address: values.address || undefined,
        status: values.status,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-dues"] });
      router.push("/customers");
    },
  });

  const handleSubmit = async (values: CustomerFormValues) => {
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

  const customer = customerData?.data;
  if (!customer) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Customer profile not found or has been deleted.
      </div>
    );
  }

  return (
    <HasPermission code="customer.edit">
      <div className="py-4">
        <CustomerForm
          initialData={customer}
          isEdit={true}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/customers")}
        />
      </div>
    </HasPermission>
  );
}
