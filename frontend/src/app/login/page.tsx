"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, User, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useSettingsStore } from "@/store/settings";

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  remember_me: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { settings } = useSettingsStore();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      remember_me: true,
    },
  });

  const onSubmit: SubmitHandler<LoginFormValues> = async (data) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await login(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setValue("username", "owner");
    setValue("password", "Owner@123456");
  };

  const brandName = settings.business_name || "Enterprise Hub";
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorative Blur Spheres */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in-50 zoom-in-95 duration-500">
        {/* Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          {settings.business_logo ? (
            <img src={settings.business_logo} alt={brandName} className="h-16 w-16 rounded-2xl object-contain bg-white shadow-lg shadow-primary/30" />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/30">
              {initial}
            </div>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {brandName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your business management portal
          </p>
        </div>

        <Card className="glass-card border-border/50 shadow-2xl backdrop-blur-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Authentication</CardTitle>
            <CardDescription>Enter your credentials to manage system resources</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Username field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Username or Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...register("username")}
                    type="text"
                    placeholder="e.g. owner or owner@enterprise.com"
                    className="pl-9 h-10"
                    autoComplete="username"
                  />
                </div>
                {errors.username && (
                  <p className="text-[11px] text-destructive">{errors.username.message}</p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="pl-9 pr-9 h-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                  <input
                    {...register("remember_me")}
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Remember me (30 days)</span>
                </label>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full h-10" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Account"
                )}
              </Button>
            </form>

            {/* Quick Demo Fill Widget */}
            <div className="mt-6 pt-4 border-t border-border/50 text-center space-y-2">
              <p className="text-[11px] text-muted-foreground">Demo System Administrator Account</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillDemoCredentials}
                className="w-full text-xs py-1.5 h-auto flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Fill Owner Credentials (<code className="">owner</code>)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
