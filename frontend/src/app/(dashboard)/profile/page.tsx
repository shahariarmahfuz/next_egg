"use client";

import { useEffect, useState } from "react";
import { User, Shield, Mail, Phone, Save, Lock, AlertCircle, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { profileService } from "@/services/api";
import { UserItem } from "@/types";
import { toast } from "sonner";
import Link from "next/link";

export default function ProfilePage() {
  const { user: authUser, hasPermission, refreshUser } = useAuth();
  const [profile, setProfile] = useState<UserItem | null>(null);
  const [fullName, setFullName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const canView = hasPermission("profile.view") || authUser?.role?.code === "owner";
  const canEdit = hasPermission("profile.edit") || authUser?.role?.code === "owner";

  useEffect(() => {
    async function loadProfile() {
      if (!canView) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await profileService.getProfile();
        if (res.success && res.data) {
          setProfile(res.data);
          setFullName(res.data.full_name || "");
          setLogoUrl(res.data.profile_logo_url || "");
        } else {
          setProfile(authUser);
          setFullName(authUser?.full_name || "");
          setLogoUrl(authUser?.profile_logo_url || "");
        }
      } catch (err: any) {
        if (err?.status === 403) {
          setAccessDenied(true);
        } else {
          setProfile(authUser);
          setFullName(authUser?.full_name || "");
          setLogoUrl(authUser?.profile_logo_url || "");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [canView, authUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("You do not have permission to edit your profile.");
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters.");
      return;
    }

    if (logoUrl.trim() && !logoUrl.trim().startsWith("http://") && !logoUrl.trim().startsWith("https://")) {
      toast.error("Profile logo URL must start with http:// or https://");
      return;
    }

    setSaving(true);
    try {
      const res = await profileService.updateProfile({
        full_name: fullName.trim(),
        profile_logo_url: logoUrl.trim() || null,
      });

      if (res.success) {
        setProfile(res.data);
        await refreshUser();
        toast.success("Profile updated successfully!");
      } else {
        toast.error(res.message || "Failed to update profile");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                You do not have permission (<code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">profile.view</code>) to access the profile page.
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center space-x-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const initial = (fullName || profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your personal identity and avatar image URL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canEdit ? (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
              <Lock className="h-3 w-3 mr-1" />
              Read-Only
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
              Editable
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar Preview & Account Info */}
        <Card className="glass-card border border-border shadow-sm md:col-span-1">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-base font-semibold">User Identity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center space-y-4 pt-2">
            {/* Live Avatar Preview */}
            <div className="relative group">
              <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-primary/20 bg-accent/40 flex items-center justify-center shadow-md">
                {logoUrl.trim() ? (
                  <img
                    src={logoUrl.trim()}
                    alt={fullName || "Profile"}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-primary">{initial}</span>
                )}
              </div>
            </div>

            <div className="space-y-1 w-full">
              <h3 className="font-bold text-lg text-foreground truncate">{fullName || profile?.full_name}</h3>
              <p className="text-xs text-muted-foreground font-mono">@{profile?.username}</p>
              <div className="pt-2 flex justify-center">
                <Badge variant={profile?.role?.code === "owner" ? "default" : "secondary"} className="capitalize text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {profile?.role?.name || profile?.role?.code || "User"}
                </Badge>
              </div>
            </div>

            <div className="w-full pt-4 border-t border-border/50 text-left space-y-2 text-xs text-muted-foreground">
              {profile?.email && (
                <div className="flex items-center space-x-2 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center space-x-2 truncate">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{profile.phone}</span>
                </div>
              )}
              <div className="text-[11px] text-muted-foreground pt-1">
                Account Status: <span className="text-emerald-600 font-semibold uppercase">{profile?.status || "active"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Editable Profile Details */}
        <Card className="glass-card border border-border shadow-sm md:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Profile Settings</CardTitle>
            <CardDescription className="text-xs">
              {canEdit
                ? "Update your display name and remote profile logo URL."
                : "You have view-only access to this profile. Contact system owner to request profile edit permission."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!canEdit || saving}
                  placeholder="Your full display name"
                  className="bg-background/50"
                  required
                />
              </div>

              {/* Profile Logo URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Profile Logo / Avatar URL</label>
                  <span className="text-[11px] text-muted-foreground">URL only (No upload)</span>
                </div>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={!canEdit || saving}
                    placeholder="https://example.com/avatar.jpg"
                    className="pl-9 bg-background/50 font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Provide a direct URL to your public avatar image (PNG, JPG, SVG, WebP). If left blank, your initial will be displayed.
                </p>
              </div>

              {/* Readonly Username Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <Input value={profile?.username || ""} disabled className="bg-muted/50 font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Assigned Role</label>
                  <Input value={profile?.role?.name || profile?.role?.code || ""} disabled className="bg-muted/50 text-xs" />
                </div>
              </div>

              {/* Submit Button */}
              {canEdit && (
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={saving} size="sm" className="px-5">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
