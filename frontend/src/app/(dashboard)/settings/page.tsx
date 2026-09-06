"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Building,
  Globe,
  DollarSign,
  Palette,
  ShieldAlert,
  Image as ImageIcon,
  Sparkles,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATIC_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { useAuth } from "@/providers/auth-provider";

const urlValidator = z
  .string()
  .refine(
    (val) => !val || val.trim() === "" || /^https?:\/\/.+/i.test(val.trim()),
    { message: "Must be a valid URL starting with http:// or https://" }
  )
  .optional()
  .or(z.literal(""));

const businessSettingsSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  business_logo: urlValidator,
  login_logo_url: urlValidator,
  favicon_url: urlValidator,
  app_icon_url: urlValidator,
  business_address: z.string().min(1, "Address is required"),
  business_phone: z.string().min(1, "Phone is required"),
  business_email: z.string().email("Invalid email"),
  website: z.string().optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required"),
  date_format: z.string().min(1, "Date format is required"),
  time_format: z.string().min(1, "Time format is required"),
  week_start: z.string().optional(),
  language: z.string().optional(),
  default_currency_id: z.string().min(1, "Default currency is required"),
  thousand_separator: z.string().optional(),
  decimal_separator: z.string().optional(),
});

type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>;

// Need some standard timezones for the dropdown
const timezones = [
  "UTC", "Asia/Dhaka", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", 
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"
];

const dateFormats = [
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (31/12/2026)" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (12/31/2026)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2026-12-31)" },
  { value: "MMM dd, yyyy", label: "MMM DD, YYYY (Dec 31, 2026)" },
];

const timeFormats = [
  { value: "hh:mm a", label: "12 Hour (02:30 PM)" },
  { value: "HH:mm", label: "24 Hour (14:30)" },
];

function AssetPreview({
  url,
  label,
  fallbackText = "No asset configured",
  className = "h-16 w-16",
  isCircle = false,
}: {
  url?: string;
  label: string;
  fallbackText?: string;
  className?: string;
  isCircle?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!url || hasError) {
    return (
      <div
        className={`${className} ${
          isCircle ? "rounded-full" : "rounded-xl"
        } border border-dashed border-muted-foreground/30 bg-muted/40 flex flex-col items-center justify-center p-2 text-center text-muted-foreground`}
      >
        <ImageIcon className="w-5 h-5 mb-1 opacity-40" />
        <span className="text-[9px] leading-tight font-medium opacity-60 line-clamp-1">
          {hasError ? "Load Error" : fallbackText}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${className} ${
        isCircle ? "rounded-full" : "rounded-xl"
      } border border-border bg-card/60 overflow-hidden shadow-sm flex items-center justify-center p-1 relative group`}
    >
      <img
        src={url}
        alt={label}
        className="h-full w-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { settings, setSettings } = useSettingsStore();
  const { user, hasPermission } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.role?.code === "owner";
  const canEdit = isOwner || hasPermission("settings.edit");
  const canView = isOwner || hasPermission("settings.view");

  const form = useForm<BusinessSettingsFormValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      business_name: settings.business_name || "",
      business_logo: settings.business_logo || "",
      login_logo_url: settings.login_logo_url || "",
      favicon_url: settings.favicon_url || "",
      app_icon_url: settings.app_icon_url || "",
      business_address: settings.business_address || "",
      business_phone: settings.business_phone || "",
      business_email: settings.business_email || "",
      website: settings.website || "",
      timezone: settings.timezone || "UTC",
      date_format: settings.date_format || "MMM dd, yyyy",
      time_format: settings.time_format || "hh:mm a",
      week_start: "Monday",
      language: "en",
      default_currency_id: settings.currency?.id || "BDT",
      thousand_separator: settings.thousand_separator || ",",
      decimal_separator: settings.decimal_separator || ".",
    },
  });

  useEffect(() => {
    form.reset({
      business_name: settings.business_name || "",
      business_logo: settings.business_logo || "",
      login_logo_url: settings.login_logo_url || "",
      favicon_url: settings.favicon_url || "",
      app_icon_url: settings.app_icon_url || "",
      business_address: settings.business_address || "",
      business_phone: settings.business_phone || "",
      business_email: settings.business_email || "",
      website: settings.website || "",
      timezone: settings.timezone || "UTC",
      date_format: settings.date_format || "MMM dd, yyyy",
      time_format: settings.time_format || "hh:mm a",
      week_start: "Monday",
      language: "en",
      default_currency_id: settings.currency?.id || "BDT",
      thousand_separator: settings.thousand_separator || ",",
      decimal_separator: settings.decimal_separator || ".",
    });
  }, [settings, form]);

  const watchedLogo = form.watch("business_logo");
  const watchedLoginLogo = form.watch("login_logo_url");
  const watchedFavicon = form.watch("favicon_url");
  const watchedAppIcon = form.watch("app_icon_url");
  const watchedBusinessName = form.watch("business_name") || "Next Egg Enterprise";

  if (!canView) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="glass-card text-center p-8 border-destructive/20 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mt-2">
            You do not have permission to view Business Settings. Contact your System Owner or Administrator.
          </p>
        </Card>
      </div>
    );
  }

  async function onSubmit(data: BusinessSettingsFormValues) {
    if (!canEdit) {
      toast.error("You do not have permission to edit business settings.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Record<string, any> = { ...data };

      // Non-owner roles are strictly blocked from submitting branding keys
      if (!isOwner) {
        delete payload.business_logo;
        delete payload.login_logo_url;
        delete payload.favicon_url;
        delete payload.app_icon_url;
      }

      const response = await apiClient("/settings/business", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const defaultCurrencyId = response.data.default_currency_id || data.default_currency_id;
      const currency = STATIC_CURRENCIES.find((c) => c.id === defaultCurrencyId) || DEFAULT_CURRENCY;

      setSettings({ ...response.data, currency });
      toast.success("Business settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="System Settings"
        description="Configure global business identity, regional formats, localized currencies, and owner branding."
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="business" className="space-y-6">
          <TabsList className="bg-accent/50 p-1 rounded-xl">
            <TabsTrigger
              value="business"
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Building className="w-4 h-4 mr-2" /> Business Profile & Localization
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger
                value="branding"
                className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Palette className="w-4 h-4 mr-2" /> Business Branding (Owner)
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: Business Settings */}
          <TabsContent value="business" className="space-y-6">
            {/* General Settings */}
            <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
              <CardHeader className="border-b border-border/50 bg-accent/20">
                <CardTitle className="text-lg flex items-center">
                  <Building className="w-5 h-5 mr-2 text-primary" /> General Profile
                </CardTitle>
                <CardDescription>
                  Basic contact, enterprise profile, and address information.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Name *</label>
                    <Input
                      {...form.register("business_name")}
                      disabled={!canEdit}
                      placeholder="e.g. Next Egg Enterprise"
                      className="bg-background/50 backdrop-blur-sm"
                    />
                    {form.formState.errors.business_name && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.business_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Phone *</label>
                    <Input
                      {...form.register("business_phone")}
                      disabled={!canEdit}
                      placeholder="+1 234 567 8900"
                      className="bg-background/50 backdrop-blur-sm"
                    />
                    {form.formState.errors.business_phone && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.business_phone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Email *</label>
                    <Input
                      {...form.register("business_email")}
                      disabled={!canEdit}
                      type="email"
                      placeholder="contact@nextegg.com"
                      className="bg-background/50 backdrop-blur-sm"
                    />
                    {form.formState.errors.business_email && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.business_email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Website (Optional)</label>
                    <Input
                      {...form.register("website")}
                      disabled={!canEdit}
                      placeholder="https://nextegg.com"
                      className="bg-background/50 backdrop-blur-sm"
                    />
                    {form.formState.errors.website && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.website.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Business Address *</label>
                    <Input
                      {...form.register("business_address")}
                      disabled={!canEdit}
                      placeholder="123 Farm Road, Suite 100, City, Country"
                      className="bg-background/50 backdrop-blur-sm"
                    />
                    {form.formState.errors.business_address && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.business_address.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Regional Settings */}
            <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
              <CardHeader className="border-b border-border/50 bg-accent/20">
                <CardTitle className="text-lg flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-primary" /> Regional & Formatting
                </CardTitle>
                <CardDescription>Configure timezones, date formats, and numeric styles</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Zone</label>
                  <Select
                    disabled={!canEdit}
                    onValueChange={(v) => form.setValue("timezone", v)}
                    value={form.watch("timezone")}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Format</label>
                  <Select
                    disabled={!canEdit}
                    onValueChange={(v) => form.setValue("date_format", v)}
                    value={form.watch("date_format")}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Date Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map((df) => (
                        <SelectItem key={df.value} value={df.value}>
                          {df.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Format</label>
                  <Select
                    disabled={!canEdit}
                    onValueChange={(v) => form.setValue("time_format", v)}
                    value={form.watch("time_format")}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Time Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeFormats.map((tf) => (
                        <SelectItem key={tf.value} value={tf.value}>
                          {tf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Thousand Separator</label>
                  <Select
                    disabled={!canEdit}
                    onValueChange={(v) => form.setValue("thousand_separator", v)}
                    value={form.watch("thousand_separator")}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Separator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=" ">Space ( )</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Decimal Separator</label>
                  <Select
                    disabled={!canEdit}
                    onValueChange={(v) => form.setValue("decimal_separator", v)}
                    value={form.watch("decimal_separator")}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Separator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=",">Comma (,)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Currency Settings */}
            <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
              <CardHeader className="border-b border-border/50 bg-accent/20">
                <CardTitle className="text-lg flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-primary" /> Default Currency
                </CardTitle>
                <CardDescription>This currency will be applied globally across all modules.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Primary Currency</label>
                    <Select
                      disabled={!canEdit}
                      onValueChange={(v) => form.setValue("default_currency_id", v)}
                      value={form.watch("default_currency_id")}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATIC_CURRENCIES.map((curr) => (
                          <SelectItem key={curr.id} value={curr.id as string}>
                            {curr.name} ({curr.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.default_currency_id && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.default_currency_id.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Business Branding (Owner Only) */}
          {isOwner && (
            <TabsContent value="branding" className="space-y-6">
              <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
                <CardHeader className="border-b border-border/50 bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Sparkles className="w-5 h-5 mr-2 text-primary" /> Business Branding Assets
                      </CardTitle>
                      <CardDescription>
                        Configure public URL links for all application assets. Images must be direct web links (HTTPS/HTTP). No file uploads required.
                      </CardDescription>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Owner Authorized
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {/* Business Logo Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4 text-primary" /> Main Business Logo URL
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Displayed in the sidebar navigation header, printable invoices, and official reports.
                      </p>
                      <Input
                        {...form.register("business_logo")}
                        placeholder="https://example.com/assets/logo.png"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.business_logo && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.business_logo.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">Live Logo Preview</span>
                      <AssetPreview url={watchedLogo} label="Business Logo" className="h-16 w-32" />
                    </div>
                  </div>

                  {/* Login Page Logo Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Login Page Logo / Brand URL
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Displayed prominently at the top of the sign-in / authentication card.
                      </p>
                      <Input
                        {...form.register("login_logo_url")}
                        placeholder="https://example.com/assets/login-banner.png"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.login_logo_url && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.login_logo_url.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">Login Brand Preview</span>
                      <AssetPreview url={watchedLoginLogo || watchedLogo} label="Login Logo" className="h-14 w-28" />
                    </div>
                  </div>

                  {/* Favicon Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" /> Browser Tab Favicon URL
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Direct icon URL loaded dynamically into the browser tab title bar (recommended: 32x32 PNG/ICO).
                      </p>
                      <Input
                        {...form.register("favicon_url")}
                        placeholder="https://example.com/assets/favicon.ico"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.favicon_url && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.favicon_url.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">Browser Tab Preview</span>
                      <div className="w-full max-w-[200px] h-8 bg-background border border-border rounded-t-lg px-2 flex items-center gap-2 text-xs shadow-sm">
                        <AssetPreview url={watchedFavicon} label="Favicon" className="h-4 w-4" />
                        <span className="truncate text-[10px] font-medium text-foreground">
                          {watchedBusinessName}
                        </span>
                        <span className="ml-auto text-muted-foreground text-[10px]">✕</span>
                      </div>
                    </div>
                  </div>

                  {/* Application / Mobile Icon Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-primary" /> Mobile / App Icon URL
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Applied as the Apple Touch Icon and mobile home screen bookmark shortcut (recommended: 180x180 PNG).
                      </p>
                      <Input
                        {...form.register("app_icon_url")}
                        placeholder="https://example.com/assets/apple-touch-icon.png"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.app_icon_url && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.app_icon_url.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">Mobile Icon Preview</span>
                      <AssetPreview url={watchedAppIcon} label="App Icon" className="h-14 w-14" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Global Save Controls */}
        {canEdit && (
          <div className="flex justify-end gap-4 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px] shadow-lg shadow-primary/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save Settings
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
