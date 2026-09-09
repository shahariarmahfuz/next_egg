"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, UserCheck, Key, Copy, Check } from "lucide-react";
import { userService } from "@/services/api";
import { RoleItem, UserItem, UserUpdatePayload } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const urlValidator = z
  .string()
  .refine(
    (val) => !val || val.trim() === "" || /^https?:\/\/.+/i.test(val.trim()),
    { message: "Must be a valid URL starting with http:// or https://" }
  )
  .optional()
  .or(z.literal(""));

const userUpdateSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  profile_logo_url: urlValidator,
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
  const isOwner = currentUser?.role?.code === "owner";
  const [isRecoveryActive, setIsRecoveryActive] = useState(user?.recovery_mode_enabled || false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isTogglingRecovery, setIsTogglingRecovery] = useState(false);

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
      setIsRecoveryActive(user.recovery_mode_enabled || false);
      setGeneratedCode(null);
      setCopied(false);
      reset({
        full_name: user.full_name,
        profile_logo_url: user.profile_logo_url || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
        role_id: user.role_id,
        status: user.status,
      });
    }
  }, [user, reset]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleToggleRecovery = async () => {
    if (!user) return;
    try {
      setIsTogglingRecovery(true);
      setErrorMsg(null);
      if (isRecoveryActive) {
        await userService.disableRecoveryMode(user.id);
        setIsRecoveryActive(false);
        setGeneratedCode(null);
        toast.success("Recovery mode disabled");
        onSuccess();
      } else {
        const res = await userService.enableRecoveryMode(user.id);
        setIsRecoveryActive(true);
        if (res.data?.recovery_code) {
          setGeneratedCode(res.data.recovery_code);
        }
        toast.success("Recovery mode enabled");
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle recovery mode");
    } finally {
      setIsTogglingRecovery(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success("Recovery code copied!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (!isOpen || !user) return null;

  const onSubmit = async (values: UserUpdateFormValues) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const payload: UserUpdatePayload = {
        full_name: values.full_name,
        profile_logo_url: values.profile_logo_url !== undefined ? (values.profile_logo_url || null) : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-5 sm:p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain my-auto touch-pan-y">
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
            <label className="text-xs font-medium">Profile Logo URL (Optional)</label>
            <Input {...register("profile_logo_url")} placeholder="https://example.com/avatar.jpg" />
            <p className="text-[10px] text-muted-foreground">Provide a direct public image link (no file upload required).</p>
            {errors.profile_logo_url && <p className="text-[11px] text-destructive">{errors.profile_logo_url.message}</p>}
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

          {isOwner && (
            <div className="p-3.5 bg-muted/40 rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-500" />
                    Recovery Mode
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Allow user to reset password via Owner recovery code on login page.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isRecoveryActive
                        ? "bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] py-0 px-2 h-5 font-semibold"
                        : "text-[10px] py-0 px-2 h-5 text-muted-foreground"
                    }
                  >
                    {isRecoveryActive ? "ON" : "OFF"}
                  </Badge>
                  <Button
                    type="button"
                    variant={isRecoveryActive ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleToggleRecovery}
                    disabled={isTogglingRecovery}
                  >
                    {isTogglingRecovery ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isRecoveryActive ? (
                      "Turn OFF"
                    ) : (
                      "Turn ON"
                    )}
                  </Button>
                </div>
              </div>

              {generatedCode && (
                <div className="mt-2 p-2.5 bg-background rounded-lg border flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">One-Time Recovery Code (30 min expiry):</div>
                    <span className="font-mono font-bold tracking-wider text-primary select-all">
                      {generatedCode}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={handleCopyCode}
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy Code"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 pb-2 sm:pb-0 border-t">
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
