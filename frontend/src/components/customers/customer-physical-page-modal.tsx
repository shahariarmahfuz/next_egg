"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { customerService } from "@/services/api";
import { CustomerItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomerPhysicalPageModalProps {
  customer: CustomerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CustomerPhysicalPageModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: CustomerPhysicalPageModalProps) {
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(customer?.physical_page_number || "");

  const mutation = useMutation({
    mutationFn: (normalizedPage: string | null) =>
      customerService.updateCustomerPhysicalPage(customer!.id, {
        physical_page_number: normalizedPage,
      }),
    onSuccess: () => {
      toast.success("Physical page number updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (customer?.id) {
        queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["customer-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["customers-search-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["customer-dues"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const msg =
        errorObj?.response?.data?.error?.message ||
        errorObj?.message ||
        "Failed to update physical page number.";
      toast.error(msg);
    },
  });

  if (!customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pageNumber.trim();
    if (trimmed.length > 50) {
      toast.error("Physical page number must be 50 characters or fewer.");
      return;
    }
    mutation.mutate(trimmed || null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Set Physical Page Number
          </DialogTitle>
          <DialogDescription>
            Assign the physical ledger book page number for{" "}
            <span className="font-semibold text-foreground">{customer.name}</span>{" "}
            <span className="text-muted-foreground">({customer.customer_code})</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-muted/40 border flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Current Physical Page No:</span>
            <span className="font-semibold text-foreground">
              {customer.physical_page_number || "Not set"}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="physicalPageNumber" className="text-xs font-semibold">
              Physical Page Number
            </Label>
            <Input
              id="physicalPageNumber"
              type="text"
              maxLength={50}
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              placeholder="e.g. 12, A-15, 12/2"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Supports text and numbers. Leave blank and save to clear.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
