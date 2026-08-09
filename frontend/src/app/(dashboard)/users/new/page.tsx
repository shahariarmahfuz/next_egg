"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { userService, roleService } from "@/services/api";
import { RoleItem, UserCreatePayload } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

const userCreateSchema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
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

export default function AddUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch available roles (backend automatically filters out Owner for Admin/Employee)
  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getRoles(),
  });

  const { user, hasPermission } = useAuth();

  const availableRoles: RoleItem[] = (rolesData?.data || []).filter((r) => {
    if (r.code === "owner") return false;
    if (user?.role?.code === "admin" && r.code === "admin") return false;
    return true;
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      full_name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirm_password: "",
      role_id: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (availableRoles.length > 0) {
      setValue("role_id", availableRoles[0].id);
    }
  }, [availableRoles, setValue]);

  if (!hasPermission("user.create")) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">403 - Forbidden</h2>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access User Management.
        </p>
      </div>
    );
  }

  const onSubmit: SubmitHandler<UserFormValues> = async (values) => {
    try {
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
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`User account "${values.username}" created successfully!`);
      // router.push("/users");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create user account.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Add New User"
        description="Create a new system user account and assign organizational role permissions."
        action={
          <Button variant="outline" onClick={() => router.push("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users List
          </Button>
        }
      />

      <Card className="glass-card border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            User Account Details
          </CardTitle>
          <CardDescription>
            Fill out the required information to provision a new user profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name *</label>
                <Input {...register("full_name")} placeholder="e.g. Sarah Jenkins" />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Username *</label>
                <Input {...register("username")} placeholder="e.g. sjenkins" />
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <Input {...register("email")} type="email" placeholder="e.g. sarah@enterprise.com" />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone Number *</label>
                <Input {...register("phone")} placeholder="e.g. +1 555-0199" />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Password *</label>
                <Input {...register("password")} type="password" placeholder="••••••••••••" />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm Password *</label>
                <Input {...register("confirm_password")} type="password" placeholder="••••••••••••" />
                {errors.confirm_password && (
                  <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Assign Role *</label>
                {isLoadingRoles ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
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
                )}
                {errors.role_id && (
                  <p className="text-xs text-destructive">{errors.role_id.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Initial Status *</label>
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

            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => router.push("/users")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create User Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
