"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, UserCheck } from "lucide-react";
import { userService } from "@/services/api";
import { RoleItem, UserItem, UserUpdatePayload } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const userUpdateSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  role_id: z.string().min(1, "Role selection is required"),
  status: z.string(),
});

type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;

interface EditUserModalProps {
  user: UserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: RoleItem[];
}

export function EditUserModal({ user, isOpen, onClose, onSuccess, roles }: EditUserModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user: currentUser } = useAuth();
  const availableRoles = roles.filter((r) => {
    if (r.code === "owner") return false;
    if (currentUser?.role?.code === "admin" && r.code === "admin") return false;
    return true;
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserUpdateFormValues>({
    resolver: zodResolver(userUpdateSchema),
  });

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name,
        email: user.email || "",
        phone: user.phone || "",
        password: "",
        role_id: user.role_id,
        status: user.status,
      });
    }
  }, [user, reset]);

  if (!isOpen || !user) return null;

  const onSubmit = async (values: UserUpdateFormValues) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const payload: UserUpdatePayload = {
        full_name: values.full_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        role_id: values.role_id,
        status: values.status,
      };
      if (values.password && values.password.trim().length > 0) {
        payload.password = values.password;
      }
      await userService.updateUser(user.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Edit User ({user.username})</h2>
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
            <label className="text-xs font-medium">Full Name *</label>
            <Input {...register("full_name")} />
            {errors.full_name && <p className="text-[11px] text-destructive">{errors.full_name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Email Address</label>
              <Input {...register("email")} type="email" />
              {errors.email && <p className="text-[11px] text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Phone Number</label>
              <Input {...register("phone")} />
              {errors.phone && <p className="text-[11px] text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">New Password (Leave blank to keep existing)</label>
            <Input {...register("password")} type="password" placeholder="••••••••••••" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Role *</label>
              <select
                {...register("role_id")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Status *</label>
              <select
                {...register("status")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update User Profile"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
