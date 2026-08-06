"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, UserPlus } from "lucide-react";
import { userService } from "@/services/api";
import { RoleItem, UserCreatePayload } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const userCreateSchema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().min(5, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string().min(1, "Please confirm your password"),
    role_id: z.string().min(1, "Role selection is required"),
    status: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type UserFormValues = z.infer<typeof userCreateSchema>;

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: RoleItem[];
}

export function AddUserModal({ isOpen, onClose, onSuccess, roles }: AddUserModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const availableRoles = roles.filter((r) => {
    if (r.code === "owner") return false;
    if (user?.role?.code === "admin" && r.code === "admin") return false;
    return true;
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      full_name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirm_password: "",
      role_id: availableRoles[0]?.id || "",
      status: "active",
    },
  });

  if (!isOpen) return null;

  const onSubmit: SubmitHandler<UserFormValues> = async (values) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const payload: UserCreatePayload = {
        full_name: values.full_name,
        username: values.username,
        email: values.email || undefined,
        phone: values.phone,
        password: values.password,
        role_id: values.role_id,
        status: values.status,
      };
      await userService.createUser(payload);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create user");
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
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Add New System User</h2>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Full Name *</label>
              <Input {...register("full_name")} placeholder="John Doe" />
              {errors.full_name && <p className="text-[11px] text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Username *</label>
              <Input {...register("username")} placeholder="johndoe" />
              {errors.username && <p className="text-[11px] text-destructive">{errors.username.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Email Address</label>
              <Input {...register("email")} type="email" placeholder="john@enterprise.com" />
              {errors.email && <p className="text-[11px] text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Phone Number *</label>
              <Input {...register("phone")} placeholder="+1 555-0199" />
              {errors.phone && <p className="text-[11px] text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Password *</label>
              <Input {...register("password")} type="password" placeholder="••••••••••••" />
              {errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Confirm Password *</label>
              <Input {...register("confirm_password")} type="password" placeholder="••••••••••••" />
              {errors.confirm_password && <p className="text-[11px] text-destructive">{errors.confirm_password.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Assign Role *</label>
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
              <label className="text-xs font-medium">Initial Status *</label>
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
                  Creating User...
                </>
              ) : (
                "Save User Account"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
