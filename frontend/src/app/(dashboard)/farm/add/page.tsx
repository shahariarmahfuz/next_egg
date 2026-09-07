'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sprout,
  Plus,
  Loader2,
  Building2,
  RefreshCw,
  Layers,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { farmService } from "@/services/api";
import { FarmBalanceItem } from "@/types";

const farmSchema = z.object({
  name: z.string().min(1, "Farm Name is required"),
  code: z.string().optional(),
  previous_tray: z.string().optional(),
  address: z.string().optional(),
  contact_number: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  status: z.string().min(1),
  notes: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

export default function AddFarmPage() {
  const [farms, setFarms] = useState<FarmBalanceItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      code: "",
      previous_tray: "0",
      address: "",
      contact_number: "",
      email: "",
      status: "active",
      notes: "",
    },
  });

  const loadFarms = async () => {
    setLoadingList(true);
    try {
      const res = await farmService.getFarms();
      if (res.success && res.data) {
        setFarms(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load farms:", err);
      toast.error("Failed to load farms list");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const onSubmit = async (data: FarmFormValues) => {
    setSubmitting(true);
    try {
      const prevQty = parseFloat(data.previous_tray || "0");

      const payload = {
        name: data.name.trim(),
        code: data.code?.trim() || undefined,
        previous_tray: isNaN(prevQty) ? 0 : Math.max(0, prevQty),
        address: data.address?.trim() || undefined,
        contact_number: data.contact_number?.trim() || undefined,
        email: data.email?.trim() || undefined,
        status: data.status || "active",
        notes: data.notes?.trim() || undefined,
      };

      const res = await farmService.createFarm(payload);
      if (res.success) {
        toast.success(`Farm "${res.data.name}" added successfully!`);
        reset({
          name: "",
          code: "",
          previous_tray: "0",
          address: "",
          contact_number: "",
          email: "",
          status: "active",
          notes: "",
        });
        // Stay on page, refresh list below
        loadFarms();
      } else {
        toast.error(res.message || "Failed to create farm");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create farm";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Farm</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Register new farm facilities with optional starting / opening tray balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/farm">
            <Button variant="outline" size="sm" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Farm Management
            </Button>
          </Link>
          <Link href="/farm/report">
            <Button variant="outline" size="sm" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
              Farm Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>Farm Details</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Enter operational details for this farm location. Stay on page after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Farm Name (Minimum Field) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Farm Name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Akota Poultry Farm"
                  {...register("name")}
                  className={errors.name ? "border-destructive text-xs" : "text-xs"}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              {/* Starting / Previous Tray (Opening Balance) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <RotateCcw className="h-3 w-3 text-amber-500" /> Previous Tray (Opening Balance)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 500"
                  {...register("previous_tray")}
                  className="text-xs"
                />
              </div>

              {/* Farm Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Farm Code <span className="text-muted-foreground text-[10px] font-normal">(Auto-generated if blank)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. AKOTA-01"
                  {...register("code")}
                  className="text-xs font-mono"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Status</label>
                <select
                  {...register("status")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Contact Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Contact Number</label>
                <Input
                  type="text"
                  placeholder="e.g. +880 1711 000000"
                  {...register("contact_number")}
                  className="text-xs"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Address / Location</label>
                <Input
                  type="text"
                  placeholder="e.g. Gazipur, Dhaka"
                  {...register("address")}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Notes / Description (Optional)</label>
              <Textarea
                rows={2}
                placeholder="Operational notes, capacity, sheds..."
                {...register("notes")}
                className="text-xs resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitting} className="min-w-[140px] text-xs">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Farm...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Farm
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Farms List */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Existing Farms ({farms.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Registered farm facilities and current live tray balances (source of truth: database)
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadFarms}
            disabled={loadingList}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">SL</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Farm Name</th>
                  <th className="px-4 py-3 text-right">Previous Tray</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Production</th>
                  <th className="px-4 py-3 text-right text-blue-600">Delivered</th>
                  <th className="px-4 py-3 text-right font-bold">Available Tray</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingList ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : farms.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      <Sprout className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="font-medium">No farms registered yet.</p>
                      <p className="text-[11px] mt-1">Use the form above to add your first farm.</p>
                    </td>
                  </tr>
                ) : (
                  farms.map((farm, idx) => (
                    <tr key={farm.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          {farm.code}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {farm.name}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {farm.previous_tray.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        +{farm.total_production.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        -{farm.total_delivered.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {farm.available_tray.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            farm.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {farm.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
