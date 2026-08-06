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
import { Loader2, Save, Building, Globe, Clock, Banknote, DollarSign } from "lucide-react";
import { useSettingsStore, BusinessSettings } from "@/store/settings";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const businessSettingsSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  timezone: z.string().min(1, "Timezone is required"),
  date_format: z.string().min(1, "Date format is required"),
  time_format: z.string().min(1, "Time format is required"),
  week_start: z.string(),
  language: z.string(),
  default_currency_id: z.string().min(1, "Default currency is required"),
  thousand_separator: z.string(),
  decimal_separator: z.string(),
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

export default function SettingsPage() {
  const { settings, setSettings } = useSettingsStore();
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BusinessSettingsFormValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      business_name: settings.business_name || "",
      timezone: settings.timezone || "UTC",
      date_format: settings.date_format || "MMM dd, yyyy",
      time_format: settings.time_format || "hh:mm a",
      week_start: "Monday",
      language: "en",
      default_currency_id: settings.currency?.id || "",
      thousand_separator: settings.thousand_separator || ",",
      decimal_separator: settings.decimal_separator || ".",
    },
  });

  useEffect(() => {
    // Load currencies for the dropdown
    async function loadCurrencies() {
      try {
        const response = await apiClient("/currencies");
        setCurrencies(response.data);
        
        // Reset form once settings and currencies are loaded
        const currentSettings = useSettingsStore.getState().settings;
        form.reset({
          business_name: currentSettings.business_name || "",
          timezone: currentSettings.timezone || "UTC",
          date_format: currentSettings.date_format || "MMM dd, yyyy",
          time_format: currentSettings.time_format || "hh:mm a",
          week_start: "Monday",
          language: "en",
          default_currency_id: currentSettings.currency?.id || "",
          thousand_separator: currentSettings.thousand_separator || ",",
          decimal_separator: currentSettings.decimal_separator || ".",
        });
      } catch (error) {
        toast.error("Failed to load currencies");
      }
    }
    loadCurrencies();
  }, [form]);

  async function onSubmit(data: BusinessSettingsFormValues) {
    try {
      setIsSubmitting(true);
      const response = await apiClient("/settings/business", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setSettings(response.data);
      toast.success("Business settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="System Settings"
        description="Configure global business settings, regional formats, and localized currencies."
      />

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-accent/50 p-1 rounded-xl">
          <TabsTrigger value="business" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building className="w-4 h-4 mr-2" /> Business Settings
          </TabsTrigger>
          <TabsTrigger value="currencies" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Banknote className="w-4 h-4 mr-2" /> Currencies Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* General Settings */}
            <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
              <CardHeader className="border-b border-border/50 bg-accent/20">
                <CardTitle className="text-lg flex items-center"><Building className="w-5 h-5 mr-2 text-primary" /> General Profile</CardTitle>
                <CardDescription>Basic information about your business</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Name</label>
                    <Input {...form.register("business_name")} placeholder="e.g. Next Egg Enterprise" className="bg-background/50 backdrop-blur-sm" />
                    {form.formState.errors.business_name && <p className="text-xs text-destructive">{form.formState.errors.business_name.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Regional Settings */}
            <Card className="glass-card border-none shadow-xl shadow-black/5 bg-gradient-to-br from-card/80 to-accent/20">
              <CardHeader className="border-b border-border/50 bg-accent/20">
                <CardTitle className="text-lg flex items-center"><Globe className="w-5 h-5 mr-2 text-primary" /> Regional & Formatting</CardTitle>
                <CardDescription>Configure timezones, date formats, and numeric styles</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Zone</label>
                  <Select onValueChange={(v) => form.setValue("timezone", v)} value={form.watch("timezone")}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Format</label>
                  <Select onValueChange={(v) => form.setValue("date_format", v)} value={form.watch("date_format")}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Date Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map(df => (
                        <SelectItem key={df.value} value={df.value}>{df.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Format</label>
                  <Select onValueChange={(v) => form.setValue("time_format", v)} value={form.watch("time_format")}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select Time Format" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeFormats.map(tf => (
                        <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Thousand Separator</label>
                  <Select onValueChange={(v) => form.setValue("thousand_separator", v)} value={form.watch("thousand_separator")}>
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
                  <Select onValueChange={(v) => form.setValue("decimal_separator", v)} value={form.watch("decimal_separator")}>
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
                <CardTitle className="text-lg flex items-center"><DollarSign className="w-5 h-5 mr-2 text-primary" /> Default Currency</CardTitle>
                <CardDescription>This currency will be applied globally across all modules.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Primary Currency</label>
                    <Select onValueChange={(v) => form.setValue("default_currency_id", v)} value={form.watch("default_currency_id")}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(curr => (
                          <SelectItem key={curr.id} value={curr.id}>{curr.name} ({curr.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.default_currency_id && <p className="text-xs text-destructive">{form.formState.errors.default_currency_id.message}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      To add new currencies or modify formatting options (decimals, position), go to the Currencies Management tab.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => form.reset()}>Discard Changes</Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[120px] shadow-lg shadow-primary/20">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="currencies">
          <Card className="glass-card border-none shadow-xl shadow-black/5">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center"><Banknote className="w-5 h-5 mr-2 text-primary" /> Currencies</CardTitle>
                  <CardDescription>Manage available currencies and their display formats</CardDescription>
                </div>
                <Button>+ Add Currency</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-accent/40 text-left border-b">
                    <tr>
                      <th className="p-3 font-medium">Currency</th>
                      <th className="p-3 font-medium">Code</th>
                      <th className="p-3 font-medium">Symbol</th>
                      <th className="p-3 font-medium">Position</th>
                      <th className="p-3 font-medium">Decimals</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.length > 0 ? currencies.map((curr) => (
                      <tr key={curr.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                        <td className="p-3 font-medium">{curr.name} {curr.is_default && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Default</span>}</td>
                        <td className="p-3 text-muted-foreground">{curr.code}</td>
                        <td className="p-3 font-mono">{curr.symbol}</td>
                        <td className="p-3 capitalize">{curr.symbol_position}</td>
                        <td className="p-3">{curr.decimal_places}</td>
                        <td className="p-3 capitalize">{curr.status}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8">Edit</Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No currencies found. Loading...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
