"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { HasPermission } from "@/providers/auth-provider";
import { CollectionForm, CollectionFormValues } from "@/components/collections/collection-form";
import { collectionService } from "@/services/api";
import { CustomerCollectionCreatePayload } from "@/types";

export default function NewCollectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: CollectionFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CustomerCollectionCreatePayload = {
        customer_id: values.customer_id,
        amount: values.amount,
        payment_method: values.payment_method,
        collection_date: new Date(values.collection_date).toISOString(),
        reference_no: values.reference_no || null,
        sale_id: values.sale_id || null,
        notes: values.notes || null,
      };

      await collectionService.createCollection(payload);
      queryClient.invalidateQueries({ queryKey: ["collections-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-financial-summary"] });
      toast.success("Collection added successfully.");
      router.push("/collections");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred while creating collection.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HasPermission code="collection.create">
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add Customer Collection"
          description="Record payment dues received from customer accounts and automatically adjust customer outstanding balance."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/collections">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Manage Collections
              </Link>
            </Button>
          }
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMessage}
          </div>
        )}

        <CollectionForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </HasPermission>
  );
}
