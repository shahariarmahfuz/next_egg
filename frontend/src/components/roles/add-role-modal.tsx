"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, ShieldPlus } from "lucide-react";
import { roleService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const roleCreateSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  code: z.string().min(2, "Role code must be at least 2 characters").regex(/^[a-z0-9_]+$/, "Code must be lowercase alphanumeric or underscore"),
  description: z.string().optional(),
});

type RoleFormValues = z.infer<typeof roleCreateSchema>;

interface AddRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRoleModal({ isOpen, onClose, onSuccess }: AddRoleModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (values: RoleFormValues) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await roleService.createRole(values);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create custom role");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-2">
            <ShieldPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Add Custom Role</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Role Display Name *</label>
            <Input {...register("name")} placeholder="e.g. Sales Manager" />
            {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Role System Code *</label>
            <Input {...register("code")} placeholder="e.g. sales_manager" />
            {errors.code && <p className="text-[11px] text-destructive">{errors.code.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Input {...register("description")} placeholder="Role responsibilities..." />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save Custom Role"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
