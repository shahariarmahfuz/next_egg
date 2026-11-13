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
  Printer,
  Search,
  ChevronsUpDown,
  X,
  Truck,
  Boxes,
  User,
  UserCheck,
  Layers,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/utils/formatters";
import { STATIC_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { DEFAULT_BRAND_ASSETS, DEFAULT_BRAND_NAME } from "@/lib/branding";
import { useAuth } from "@/providers/auth-provider";
import { supplierService, customerService, settingsService } from "@/services/api";

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
  defaultUrl,
  defaultDarkUrl,
  label,
  fallbackText = "No asset configured",
  className = "h-16 w-16",
  isCircle = false,
}: {
  url?: string;
  defaultUrl?: string;
  defaultDarkUrl?: string;
  label: string;
  fallbackText?: string;
  className?: string;
  isCircle?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  const remoteUrl = !hasError && url?.trim() ? url.trim() : "";

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!remoteUrl && !defaultUrl) {
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
      {remoteUrl ? (
        <img
          src={remoteUrl}
          alt={label}
          className="h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <>
          <img
            src={defaultUrl}
            alt={label}
            className={`h-full w-full object-contain ${defaultDarkUrl ? "dark:hidden" : ""}`}
          />
          {defaultDarkUrl && (
            <img
              src={defaultDarkUrl}
              alt={label}
              className="hidden dark:block h-full w-full object-contain"
            />
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsPage({ defaultTab = "business" }: { defaultTab?: string }) {
  const { settings, setSettings } = useSettingsStore();
  const { user, hasPermission } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.role?.code === "owner";
  const canEdit = isOwner || hasPermission("settings.edit");
  const canView = isOwner || hasPermission("settings.view");

  // Owner-only Supplier Print configuration query and state
  const { data: supplierPrintConfigData, refetch: refetchSupplierPrint } = useQuery({
    queryKey: ["supplier-print-config"],
    queryFn: () => settingsService.getSupplierPrintConfig(),
    enabled: isOwner,
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [openSupplierPopover, setOpenSupplierPopover] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  useEffect(() => {
    if (supplierPrintConfigData?.data) {
      setSelectedSupplierId(supplierPrintConfigData.data.supplier_id || "");
      setSelectedSupplier(supplierPrintConfigData.data.supplier || null);
    }
  }, [supplierPrintConfigData]);

  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);

  const { data: searchSuppliersData, isLoading: isSearchingSuppliers } = useQuery({
    queryKey: ["suppliers-search-settings", debouncedSupplierSearch],
    queryFn: () => supplierService.getSuppliers({ search: debouncedSupplierSearch || undefined, size: 20 }),
    enabled: isOwner && openSupplierPopover,
  });

  const searchedSuppliers = searchSuppliersData?.data?.items || [];

  const handleSaveSupplierPrint = async () => {
    if (!isOwner) return;
    try {
      setIsSavingSupplier(true);
      await settingsService.updateSupplierPrintConfig({ supplier_id: selectedSupplierId || null });
      await refetchSupplierPrint();
      toast.success("Supplier Print configuration saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save Supplier Print setting");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleClearSupplierPrint = () => {
    setSelectedSupplierId("");
    setSelectedSupplier(null);
  };

  // Stock Report Customer configuration query and state
  const { data: stockReportCustomerConfigData, refetch: refetchStockReportCustomer } = useQuery({
    queryKey: ["stock-report-customer-config"],
    queryFn: () => settingsService.getStockReportCustomerConfig(),
    enabled: canEdit,
  });

  const [selectedStockCustomerId, setSelectedStockCustomerId] = useState<string>("");
  const [selectedStockCustomer, setSelectedStockCustomer] = useState<any>(null);
  const [stockCustomerSearch, setStockCustomerSearch] = useState("");
  const [openStockCustomerPopover, setOpenStockCustomerPopover] = useState(false);
  const [isSavingStockCustomer, setIsSavingStockCustomer] = useState(false);

  useEffect(() => {
    if (stockReportCustomerConfigData?.data) {
      setSelectedStockCustomerId(stockReportCustomerConfigData.data.customer_id || "");
      setSelectedStockCustomer(stockReportCustomerConfigData.data.customer || null);
    }
  }, [stockReportCustomerConfigData]);

  const debouncedStockCustomerSearch = useDebounce(stockCustomerSearch, 300);

  const { data: searchCustomersData, isLoading: isSearchingStockCustomers } = useQuery({
    queryKey: ["customers-search-stock-settings", debouncedStockCustomerSearch],
    queryFn: () => customerService.getCustomers({ search: debouncedStockCustomerSearch || undefined, size: 20 }),
    enabled: canEdit && openStockCustomerPopover,
  });

  const searchedCustomers = searchCustomersData?.data?.items || [];

  const handleSaveStockReportCustomer = async () => {
    if (!canEdit) return;
    try {
      setIsSavingStockCustomer(true);
      await settingsService.updateStockReportCustomerConfig({ customer_id: selectedStockCustomerId || null });
      toast.success("Stock Report dedicated customer saved successfully");
      await refetchStockReportCustomer();
    } catch (error: any) {
      toast.error(error.message || "Failed to save Stock Report customer setting");
    } finally {
      setIsSavingStockCustomer(false);
    }
  };

  const handleClearStockReportCustomer = () => {
    setSelectedStockCustomerId("");
    setSelectedStockCustomer(null);
  };

  // Print Transaction Merge Settings query and state
  const { data: printMergeConfigData, refetch: refetchPrintMergeConfig } = useQuery({
    queryKey: ["print-merge-config"],
    queryFn: () => settingsService.getPrintMergeConfig(),
    enabled: canEdit,
  });

  const [printMergeMode, setPrintMergeMode] = useState<"normal" | "selected" | "all">("normal");
  const [selectedPrintCustomers, setSelectedPrintCustomers] = useState<any[]>([]);
  const [printCustomerSearch, setPrintCustomerSearch] = useState("");
  const [openPrintCustomerPopover, setOpenPrintCustomerPopover] = useState(false);
  const [isSavingPrintMerge, setIsSavingPrintMerge] = useState(false);

  useEffect(() => {
    if (printMergeConfigData?.data) {
      setPrintMergeMode(printMergeConfigData.data.merge_mode || "normal");
      setSelectedPrintCustomers(printMergeConfigData.data.selected_customers || []);
    }
  }, [printMergeConfigData]);

  const debouncedPrintCustomerSearch = useDebounce(printCustomerSearch, 300);

  const { data: searchPrintCustomersData, isLoading: isSearchingPrintCustomers } = useQuery({
    queryKey: ["customers-search-print-merge-settings", debouncedPrintCustomerSearch],
    queryFn: () => customerService.getCustomers({ search: debouncedPrintCustomerSearch || undefined, size: 25 }),
    enabled: canEdit && openPrintCustomerPopover,
  });

  const searchedPrintCustomers = searchPrintCustomersData?.data?.items || [];

  const handleTogglePrintCustomer = (cust: any) => {
    if (!cust?.id) return;
    const exists = selectedPrintCustomers.some((c) => c.id === cust.id);
    if (exists) {
      setSelectedPrintCustomers((prev) => prev.filter((c) => c.id !== cust.id));
    } else {
      setSelectedPrintCustomers((prev) => [
        ...prev,
        {
          id: cust.id,
          name: cust.name,
          customer_code: cust.customer_code,
          phone: cust.phone,
          current_balance: cust.current_balance,
        },
      ]);
    }
  };

  const handleRemovePrintCustomer = (customerId: string) => {
    setSelectedPrintCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const handleSavePrintMergeConfig = async () => {
    if (!canEdit) return;
    try {
      setIsSavingPrintMerge(true);
      await settingsService.updatePrintMergeConfig({
        merge_mode: printMergeMode,
        selected_customer_ids: selectedPrintCustomers.map((c) => c.id),
      });
      toast.success("Print Settings (Transaction Merge Mode) saved successfully");
      await refetchPrintMergeConfig();
    } catch (error: any) {
      toast.error(error.message || "Failed to save Print settings");
    } finally {
      setIsSavingPrintMerge(false);
    }
  };

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
  const watchedBusinessName = form.watch("business_name") || DEFAULT_BRAND_NAME;
  const hasAnyRemoteBrand = Boolean(
    watchedLogo?.trim() ||
      watchedLoginLogo?.trim() ||
      watchedFavicon?.trim() ||
      watchedAppIcon?.trim()
  );

  const handleUseBuiltInDefaults = () => {
    form.setValue("business_logo", "", { shouldDirty: true });
    form.setValue("login_logo_url", "", { shouldDirty: true });
    form.setValue("favicon_url", "", { shouldDirty: true });
    form.setValue("app_icon_url", "", { shouldDirty: true });
    toast.info("Cleared remote URLs to use built-in Akota Poultry defaults. Click Save Changes to apply.");
  };

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
        <Tabs defaultValue={defaultTab} className="space-y-6 w-full max-w-full overflow-visible">
          <div className="w-full max-w-full overflow-visible">
            <TabsList className="h-auto w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 lg:inline-flex lg:flex-row gap-1.5 p-1.5 bg-accent/50 rounded-xl">
              <TabsTrigger
                value="business"
                className="w-full lg:w-auto justify-start lg:justify-center px-3 py-2.5 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-left sm:text-center flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Building className="w-4 h-4 shrink-0" />
                <span>Business Profile & Localization</span>
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger
                  value="branding"
                  className="w-full lg:w-auto justify-start lg:justify-center px-3 py-2.5 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-left sm:text-center flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Palette className="w-4 h-4 shrink-0" />
                  <span>Business Branding (Owner)</span>
                </TabsTrigger>
              )}
              {isOwner && (
                <TabsTrigger
                  value="supplier-print"
                  className="w-full lg:w-auto justify-start lg:justify-center px-3 py-2.5 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-left sm:text-center flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>Supplier Print (Owner)</span>
                </TabsTrigger>
              )}
              {canEdit && (
                <TabsTrigger
                  value="stock-report"
                  className="w-full lg:w-auto justify-start lg:justify-center px-3 py-2.5 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-left sm:text-center flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Boxes className="w-4 h-4 shrink-0" />
                  <span>Stock Report Customer</span>
                </TabsTrigger>
              )}
              {canEdit && (
                <TabsTrigger
                  value="print-settings"
                  className="w-full lg:w-auto justify-start lg:justify-center px-3 py-2.5 text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap text-left sm:text-center flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  <span>Print Settings</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Sparkles className="w-5 h-5 mr-2 text-primary" /> Business Branding Assets
                      </CardTitle>
                      <CardDescription>
                        Paste remote HTTPS/HTTP URLs to override branding, or leave blank to use the built-in optimized Akota Poultry logo and icons.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {hasAnyRemoteBrand && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleUseBuiltInDefaults}
                          className="h-7 text-xs gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Disable Remote (Use Default)
                        </Button>
                      )}
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Owner Authorized
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {/* Business Logo Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Building className="w-4 h-4 text-primary" /> Main Business Logo URL
                        </label>
                        {watchedLogo?.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.setValue("business_logo", "", { shouldDirty: true })}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Use Default
                          </Button>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Built-in Akota Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Displayed in the sidebar navigation header, printable invoices, and official reports. Leave blank to use built-in Akota Poultry mark.
                      </p>
                      <Input
                        {...form.register("business_logo")}
                        placeholder="https://example.com/assets/logo.png (optional)"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.business_logo && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.business_logo.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">
                        {watchedLogo?.trim() ? "Remote Logo Preview" : "Default Akota Preview"}
                      </span>
                      <AssetPreview
                        url={watchedLogo}
                        defaultUrl={DEFAULT_BRAND_ASSETS.businessLogo}
                        defaultDarkUrl={DEFAULT_BRAND_ASSETS.businessLogoDark}
                        label="Business Logo"
                        className="h-16 w-32"
                      />
                    </div>
                  </div>

                  {/* Login Page Logo Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" /> Login Page Logo / Brand URL
                        </label>
                        {watchedLoginLogo?.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.setValue("login_logo_url", "", { shouldDirty: true })}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Use Default
                          </Button>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Built-in Akota Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Displayed prominently at the top of the sign-in card. Falls back to Business Logo or built-in Akota mark when blank.
                      </p>
                      <Input
                        {...form.register("login_logo_url")}
                        placeholder="https://example.com/assets/login-banner.png (optional)"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.login_logo_url && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.login_logo_url.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">
                        {watchedLoginLogo?.trim() ? "Remote Login Preview" : "Default Akota Preview"}
                      </span>
                      <AssetPreview
                        url={watchedLoginLogo || watchedLogo}
                        defaultUrl={DEFAULT_BRAND_ASSETS.loginLogo}
                        defaultDarkUrl={DEFAULT_BRAND_ASSETS.loginLogoDark}
                        label="Login Logo"
                        className="h-14 w-28"
                      />
                    </div>
                  </div>

                  {/* Favicon Asset */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start p-4 rounded-xl border border-border/50 bg-card/40">
                    <div className="lg:col-span-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" /> Browser Tab Favicon URL
                        </label>
                        {watchedFavicon?.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.setValue("favicon_url", "", { shouldDirty: true })}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Use Default
                          </Button>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Built-in Akota Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Optional remote icon URL for the browser tab. Leave blank to use the built-in Akota Poultry SVG/ICO favicon.
                      </p>
                      <Input
                        {...form.register("favicon_url")}
                        placeholder="https://example.com/assets/favicon.ico (optional)"
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
                        <AssetPreview url={watchedFavicon} defaultUrl={DEFAULT_BRAND_ASSETS.favicon} label="Favicon" className="h-4 w-4" />
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
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-primary" /> Mobile / App Icon URL
                        </label>
                        {watchedAppIcon?.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.setValue("app_icon_url", "", { shouldDirty: true })}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Use Default
                          </Button>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Built-in Akota Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Optional remote PNG URL for Apple Touch Icon / mobile home screen shortcut. Leave blank to use built-in Akota Poultry 180×180 icon.
                      </p>
                      <Input
                        {...form.register("app_icon_url")}
                        placeholder="https://example.com/assets/apple-touch-icon.png (optional)"
                        className="bg-background/50 font-mono text-xs"
                      />
                      {form.formState.errors.app_icon_url && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.app_icon_url.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/20 border border-border/40">
                      <span className="text-[11px] font-medium text-muted-foreground mb-2">
                        {watchedAppIcon?.trim() ? "Remote Icon Preview" : "Default Akota Preview"}
                      </span>
                      <AssetPreview url={watchedAppIcon} defaultUrl={DEFAULT_BRAND_ASSETS.appIcon} label="App Icon" className="h-14 w-14" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 3: Supplier Print (Owner Only) */}
          {isOwner && (
            <TabsContent value="supplier-print" className="space-y-6">
              <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
                <CardHeader className="border-b border-border/50 bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Printer className="w-5 h-5 mr-2 text-primary" /> Supplier Print
                      </CardTitle>
                      <CardDescription>
                        Select a dedicated supplier whose daily account statement will be included in the Cash Book Print.
                      </CardDescription>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Owner Authorized
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2 max-w-xl">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" /> Select Supplier
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Owner can select exactly one supplier. Their daily account (Previous Due, Purchases, Returns, Payments, and Closing Due) will be displayed in section 4 of the Cash Book Print.
                    </p>

                    <Popover open={openSupplierPopover} onOpenChange={setOpenSupplierPopover}>
                      <PopoverTrigger asChild>
                        {selectedSupplier ? (
                          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs w-full">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Truck className="h-4 w-4 text-primary shrink-0" />
                              <div className="truncate">
                                <span className="font-semibold text-foreground text-sm block">
                                  {selectedSupplier.name}
                                </span>
                                <span className="text-muted-foreground text-xs block">
                                  Code: {selectedSupplier.supplier_code || "—"} | Phone: {selectedSupplier.phone || "—"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-background/80 border text-foreground">
                                Due: {formatCurrency(selectedSupplier.current_balance || 0)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearSupplierPrint();
                                }}
                                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                title="Clear selected supplier"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openSupplierPopover}
                            className="w-full justify-between h-10 text-xs sm:text-sm font-normal bg-background/50 border-input hover:bg-accent/50"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground truncate">
                              <Search className="h-4 w-4 shrink-0 opacity-70" />
                              Select or search supplier (Name, Phone, Code)...
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        )}
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search supplier name, code, phone..."
                            value={supplierSearch}
                            onValueChange={setSupplierSearch}
                          />
                          <CommandList className="max-h-60 overflow-y-auto">
                            {isSearchingSuppliers ? (
                              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                Searching suppliers...
                              </div>
                            ) : searchedSuppliers.length === 0 ? (
                              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                                No suppliers found.
                              </CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {searchedSuppliers.map((supp: any) => (
                                  <CommandItem
                                    key={supp.id}
                                    value={`${supp.name} ${supp.supplier_code || ""} ${supp.phone || ""}`}
                                    onSelect={() => {
                                      setSelectedSupplierId(supp.id);
                                      setSelectedSupplier(supp);
                                      setOpenSupplierPopover(false);
                                      setSupplierSearch("");
                                    }}
                                    className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium text-foreground block">{supp.name}</span>
                                      <span className="text-[11px] text-muted-foreground font-mono">
                                        {supp.supplier_code || "—"} {supp.phone ? `| ${supp.phone}` : ""}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                                      ৳ {supp.current_balance?.toLocaleString() || 0}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      onClick={handleSaveSupplierPrint}
                      disabled={isSavingSupplier}
                      className="min-w-[140px] shadow-lg shadow-primary/20"
                    >
                      {isSavingSupplier ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save Supplier Print
                        </>
                      )}
                    </Button>
                    {selectedSupplierId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          handleClearSupplierPrint();
                          try {
                            setIsSavingSupplier(true);
                            await settingsService.updateSupplierPrintConfig({ supplier_id: null });
                            await refetchSupplierPrint();
                            toast.success("Supplier Print setting cleared");
                          } catch (err: any) {
                            toast.error(err.message || "Failed to clear");
                          } finally {
                            setIsSavingSupplier(false);
                          }
                        }}
                        disabled={isSavingSupplier}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Remove Selected Supplier
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 4: Stock Report Customer */}
          {canEdit && (
            <TabsContent value="stock-report" className="space-y-6">
              <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
                <CardHeader className="border-b border-border/50 bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Boxes className="w-5 h-5 mr-2 text-primary" /> Stock Report Dedicated Customer
                      </CardTitle>
                      <CardDescription>
                        Select a specific customer whose sales will be displayed in their own separate summary card on the Stock Report and excluded from the Cash Sales and Due Sales breakdown.
                      </CardDescription>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Stock Report Setting
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2 max-w-xl">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" /> Select Dedicated Customer
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Authorized users can select exactly one customer. Their sales for the selected product and date will appear in a separate card and will not be mixed into Cash Sales or Due Sales.
                    </p>

                    <Popover open={openStockCustomerPopover} onOpenChange={setOpenStockCustomerPopover}>
                      <PopoverTrigger asChild>
                        {selectedStockCustomer ? (
                          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs w-full">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserCheck className="h-4 w-4 text-primary shrink-0" />
                              <div className="truncate">
                                <span className="font-semibold text-foreground text-sm block">
                                  {selectedStockCustomer.name}
                                </span>
                                <span className="text-muted-foreground text-xs block">
                                  Code: {selectedStockCustomer.customer_code || "—"} | Phone: {selectedStockCustomer.phone || "—"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-background/80 border text-foreground">
                                Due: {formatCurrency(selectedStockCustomer.current_balance || 0)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearStockReportCustomer();
                                }}
                                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                title="Clear selected customer"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openStockCustomerPopover}
                            className="w-full justify-between h-10 text-xs sm:text-sm font-normal bg-background/50 border-input hover:bg-accent/50"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground truncate">
                              <Search className="h-4 w-4 shrink-0 opacity-70" />
                              Select or search customer (Name, Phone, Code)...
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        )}
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search customer name, code, phone..."
                            value={stockCustomerSearch}
                            onValueChange={setStockCustomerSearch}
                          />
                          <CommandList className="max-h-60 overflow-y-auto">
                            {isSearchingStockCustomers ? (
                              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                Searching customers...
                              </div>
                            ) : searchedCustomers.length === 0 ? (
                              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                                No customers found.
                              </CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {searchedCustomers.map((cust: any) => (
                                  <CommandItem
                                    key={cust.id}
                                    value={`${cust.name} ${cust.customer_code || ""} ${cust.phone || ""}`}
                                    onSelect={() => {
                                      setSelectedStockCustomerId(cust.id);
                                      setSelectedStockCustomer(cust);
                                      setOpenStockCustomerPopover(false);
                                      setStockCustomerSearch("");
                                    }}
                                    className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium text-foreground block">{cust.name}</span>
                                      <span className="text-[11px] text-muted-foreground font-mono">
                                        {cust.customer_code || "—"} {cust.phone ? `| ${cust.phone}` : ""}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                                      Due: {formatCurrency(cust.current_balance || 0)}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      onClick={handleSaveStockReportCustomer}
                      disabled={isSavingStockCustomer}
                      className="min-w-[140px] shadow-lg shadow-primary/20"
                    >
                      {isSavingStockCustomer ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save Customer Setting
                        </>
                      )}
                    </Button>
                    {selectedStockCustomerId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          handleClearStockReportCustomer();
                          try {
                            setIsSavingStockCustomer(true);
                            await settingsService.updateStockReportCustomerConfig({ customer_id: null });
                            await refetchStockReportCustomer();
                            toast.success("Stock Report customer setting cleared");
                          } catch (err: any) {
                            toast.error(err.message || "Failed to clear");
                          } finally {
                            setIsSavingStockCustomer(false);
                          }
                        }}
                        disabled={isSavingStockCustomer}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Remove Selected Customer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 5: Print Settings (Customer Transaction Merge Mode) */}
          {canEdit && (
            <TabsContent value="print-settings" className="space-y-6">
              <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
                <CardHeader className="border-b border-border/50 bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Printer className="w-5 h-5 mr-2 text-primary" /> Print Settings (Transaction Merge Mode)
                      </CardTitle>
                      <CardDescription>
                        ক্যাশ বুক স্টেটমেন্ট প্রিন্ট করার সময় একই দিনে একজন কাস্টমারের একাধিক লেনদেন কীভাবে প্রদর্শিত হবে তা নির্ধারণ করুন।
                      </CardDescription>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Print Settings
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* 3 Option Radio Cards */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-primary" /> কাস্টমার লেনদেন মার্জ মোড
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {/* Option 1: Normal */}
                      <div
                        onClick={() => setPrintMergeMode("normal")}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          printMergeMode === "normal"
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : "border-border/60 hover:border-border hover:bg-accent/30"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                              <FileText className="w-4 h-4" />
                            </div>
                            <input
                              type="radio"
                              name="printMergeMode"
                              checked={printMergeMode === "normal"}
                              onChange={() => setPrintMergeMode("normal")}
                              className="accent-primary h-4 w-4"
                            />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">1. Normal (ডিফল্ট)</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            কোনো মার্জ হবে না। সারাদিনে যতবারই মাল নেওয়া হবে, প্রিন্টে ততবারই আলাদা সারিতে নাম উঠবে।
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mt-3 block">
                          • ক্রমানুসারে প্রতিটি চালান আলাদা থাকবে
                        </span>
                      </div>

                      {/* Option 2: Selected Merge */}
                      <div
                        onClick={() => setPrintMergeMode("selected")}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          printMergeMode === "selected"
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : "border-border/60 hover:border-border hover:bg-accent/30"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <UserCheck className="w-4 h-4" />
                            </div>
                            <input
                              type="radio"
                              name="printMergeMode"
                              checked={printMergeMode === "selected"}
                              onChange={() => setPrintMergeMode("selected")}
                              className="accent-primary h-4 w-4"
                            />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">2. Selected Merge (সিলেক্টেড মার্জ)</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            শুধুমাত্র নির্বাচিত কাস্টমারদের সারাদিনের একাধিক লেনদেন যোগ হয়ে ১টি মাত্র সারিতে দেখাবে।
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-3 block">
                          • শুধু নির্দিষ্ট পাইকারি কাস্টমার মার্জ হবে
                        </span>
                      </div>

                      {/* Option 3: All Merge */}
                      <div
                        onClick={() => setPrintMergeMode("all")}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          printMergeMode === "all"
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : "border-border/60 hover:border-border hover:bg-accent/30"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                              <Layers className="w-4 h-4" />
                            </div>
                            <input
                              type="radio"
                              name="printMergeMode"
                              checked={printMergeMode === "all"}
                              onChange={() => setPrintMergeMode("all")}
                              className="accent-primary h-4 w-4"
                            />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">3. All Merge (অল মার্জ)</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            সব কাস্টমারের একাধিক লেনদেন স্বয়ংক্রিয়ভাবে মার্জ হয়ে কাস্টমার প্রতি ১টি মাত্র সারিতে দেখাবে।
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 mt-3 block">
                          • প্রতিটি কাস্টমারের নাম সর্বোচ্চ একবার উঠবে
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Customer Picker when in "selected" mode */}
                  {printMergeMode === "selected" && (
                    <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-primary" /> মার্জ করার জন্য কাস্টমার নির্বাচন করুন
                          </label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            যেসব কাস্টমারকে যোগ করবেন, শুধু তাদের একাধিক চালান ১ লাইনে মোট হয়ে প্রিন্ট হবে।
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary self-start sm:self-auto">
                          {selectedPrintCustomers.length} জন নির্বাচিত
                        </span>
                      </div>

                      {/* Popover to search & add customer */}
                      <Popover open={openPrintCustomerPopover} onOpenChange={setOpenPrintCustomerPopover}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between h-10 text-xs sm:text-sm font-normal bg-background/80 border-input hover:bg-accent/50"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground truncate">
                              <Search className="h-4 w-4 shrink-0 opacity-70" />
                              Search & add customer to merge list...
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[calc(100vw-2rem)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search customer name, code, phone..."
                              value={printCustomerSearch}
                              onValueChange={setPrintCustomerSearch}
                            />
                            <CommandList className="max-h-60 overflow-y-auto">
                              {isSearchingPrintCustomers ? (
                                <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                  Searching customers...
                                </div>
                              ) : searchedPrintCustomers.length === 0 ? (
                                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                                  No customers found.
                                </CommandEmpty>
                              ) : (
                                <CommandGroup>
                                  {searchedPrintCustomers.map((cust: any) => {
                                    const isAdded = selectedPrintCustomers.some((c) => c.id === cust.id);
                                    return (
                                      <CommandItem
                                        key={cust.id}
                                        value={`${cust.name} ${cust.customer_code || ""} ${cust.phone || ""}`}
                                        onSelect={() => {
                                          handleTogglePrintCustomer(cust);
                                        }}
                                        className="py-2.5 px-3 hover:bg-accent/70 cursor-pointer text-xs flex items-center justify-between gap-2"
                                      >
                                        <div className="truncate">
                                          <span className="font-medium text-foreground block">{cust.name}</span>
                                          <span className="text-[11px] text-muted-foreground font-mono">
                                            {cust.customer_code || "—"} {cust.phone ? `| ${cust.phone}` : ""}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] font-semibold text-muted-foreground">
                                            Due: {formatCurrency(cust.current_balance || 0)}
                                          </span>
                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                              isAdded
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                            }`}
                                          >
                                            {isAdded ? "Added ✓" : "+ Add"}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {/* Chips of Selected Customers */}
                      {selectedPrintCustomers.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {selectedPrintCustomers.map((cust) => (
                            <span
                              key={cust.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border shadow-2xs text-xs font-medium text-foreground"
                            >
                              <span>{cust.name}</span>
                              {cust.customer_code && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  ({cust.customer_code})
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePrintCustomer(cust.id)}
                                className="h-4 w-4 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors ml-0.5"
                                title="Remove"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Save Button for Print Settings */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      onClick={handleSavePrintMergeConfig}
                      disabled={isSavingPrintMerge}
                      className="min-w-[140px] shadow-lg shadow-primary/20"
                    >
                      {isSavingPrintMerge ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save Print Settings
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Global Save Controls */}
        {canEdit && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 w-full pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              className="w-full sm:w-auto justify-center"
            >
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto justify-center min-w-[140px] shadow-lg shadow-primary/20"
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
