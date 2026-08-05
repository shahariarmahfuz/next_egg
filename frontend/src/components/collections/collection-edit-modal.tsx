"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollectionForm, CollectionFormValues } from "./collection-form";
import { CustomerCollectionItem, CustomerCollectionUpdatePayload } from "@/types";
import { collectionService } from "@/services/api";

interface CollectionEditModalProps {
  collection: CustomerCollectionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CollectionEditModal({ collection, isOpen, onClose, onSuccess }: CollectionEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !collection) return null;

  const handleSubmit = async (values: CollectionFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: CustomerCollectionUpdatePayload = {
        amount: values.amount,
        payment_method: values.payment_method,
        collection_date: new Date(values.collection_date).toISOString(),
        reference_no: values.reference_no || null,
        notes: values.notes || null,
      };
      await collectionService.updateCollection(collection.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to update collection voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit Collection Voucher - {collection.collection_no}</h2>
            <span className="text-xs text-muted-foreground">
              Modify payment details. Customer due balance will be recalculated automatically.
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30">
            {errorMsg}
          </div>
        )}

        <CollectionForm
          initialData={collection}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
