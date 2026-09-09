"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, Key, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/store/settings";
import { authService } from "@/services/api";
import { toast } from "sonner";

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  remember_me: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type FlowStep = "login" | "verify" | "reset";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { settings } = useSettingsStore();
  const router = useRouter();

  const [step, setStep] = useState<FlowStep>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery flow state
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoverySessionToken, setRecoverySessionToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated && step === "login") {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router, step]);

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

  const onLoginSubmit: SubmitHandler<LoginFormValues> = async (data) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await login(data);
      if (res?.recovery_required) {
        setRecoveryUsername(res.username || data.username);
        if (res.recovery_verified && res.recovery_token) {
          setRecoverySessionToken(res.recovery_token);
          setStep("reset");
          setSuccessMsg("Recovery code verified. Please set a new password.");
        } else {
          setStep("verify");
          setErrorMsg(null);
          setSuccessMsg("Account is in Recovery Mode. Enter your Owner-authorized recovery code to continue.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setErrorMsg("Please enter the recovery verification code.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await authService.verifyRecoveryCode({
        username: recoveryUsername,
        recovery_code: recoveryCode.trim(),
      });

      if (res.success && res.data?.recovery_token) {
        setRecoverySessionToken(res.data.recovery_token);
        setStep("reset");
        setSuccessMsg("Recovery code verified successfully. Please set your new password.");
      } else {
        setErrorMsg("Failed to verify recovery code.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired recovery code. Please contact the System Owner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setErrorMsg("Password cannot be empty.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await authService.resetPasswordWithRecovery({
        recovery_token: recoverySessionToken,
        new_password: newPassword,
      });

      if (res.success) {
        toast.success("Password reset successfully! Please sign in with your new password.");
        setStep("login");
        setSuccessMsg("Password reset successfully! You can now sign in with your new password.");
        setValue("password", "");
        setRecoveryCode("");
        setRecoverySessionToken("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Recovery session may have expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRecovery = () => {
    setStep("login");
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecoveryCode("");
    setRecoverySessionToken("");
    setNewPassword("");
    setConfirmPassword("");
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
          {settings.login_logo_url || settings.business_logo ? (
            <img
              src={settings.login_logo_url || settings.business_logo}
              alt={brandName}
              className="h-16 w-16 rounded-2xl object-contain bg-white shadow-lg shadow-primary/30"
            />
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
          {step === "login" && (
            <>
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
                {successMsg && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs animate-in fade-in-50">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
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
              </CardContent>
            </>
          )}

          {step === "verify" && (
            <>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Account Recovery</CardTitle>
                    <CardDescription>
                      Enter Owner-authorized recovery code for <strong className="text-foreground">@{recoveryUsername}</strong>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {errorMsg && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={onVerifyRecoveryCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Recovery Verification Code</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        placeholder="e.g. REC-XXXX-XXXX"
                        className="pl-9 h-10 font-mono tracking-wide uppercase"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Obtain this one-time verification code from the System Owner.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full h-10" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying Code...
                        </>
                      ) : (
                        "Verify Recovery Code"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-9 text-xs text-muted-foreground"
                      onClick={handleCancelRecovery}
                      disabled={isSubmitting}
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Back to Sign In
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {step === "reset" && (
            <>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Set New Password</CardTitle>
                    <CardDescription>
                      Create a new password for <strong className="text-foreground">@{recoveryUsername}</strong>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {errorMsg && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs animate-in fade-in-50">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={onResetPasswordSubmit} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pl-9 pr-9 h-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pl-9 pr-9 h-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full h-10" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving New Password...
                        </>
                      ) : (
                        "Save New Password"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-9 text-xs text-muted-foreground"
                      onClick={handleCancelRecovery}
                      disabled={isSubmitting}
                    >
                      Cancel Recovery
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
