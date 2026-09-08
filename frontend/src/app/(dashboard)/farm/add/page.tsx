'use client';

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sprout, Plus, Loader2, Layers, Truck, PlusCircle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { farmService } from "@/services/api";
import { useAuth, HasPermission } from "@/providers/auth-provider";

export default function AddFarmPage() {
  const { hasPermission } = useAuth();
  const [farmName, setFarmName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = farmName.trim();
    if (!trimmed) {
      toast.error("Farm Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await farmService.createFarm({ name: trimmed });
      if (res.success) {
        toast.success(`Farm "${res.data.name}" added successfully`);
        setFarmName(""); // Clear form for next entry
        // Stay on page, no redirect
      } else {
        toast.error(res.message || "Failed to add farm");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to add farm";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HasPermission
      code="farm.create"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to add a Farm.
        </div>
      }
    >
      <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-border pb-3 sm:pb-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg sm:rounded-xl shrink-0">
              <Sprout className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Add Farm</h1>
              <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Create a new farm location. It will immediately be available in Production and Delivery.
              </p>
            </div>
          </div>

          {hasPermission(["farm.view", "farm.edit", "farm.delete"]) && (
            <div className="flex items-center gap-2">
              <Link href="/farm">
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Manage Farm
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Form Card */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="py-2.5 px-3 sm:py-4 sm:px-6 border-b border-border">
            <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
              New Farm
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter the farm name below to create a new farm.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="farmName" className="text-xs font-semibold text-foreground">
                  Farm Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="farmName"
                  type="text"
                  placeholder="e.g. Akota Poultry Farm"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  disabled={submitting}
                  className="text-xs sm:text-sm h-9 sm:h-10"
                  autoFocus
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <p className="text-[11px] text-muted-foreground text-center sm:text-left">
                  After adding, you can configure starting trays in Manage Farm.
                </p>
                <Button type="submit" disabled={submitting || !farmName.trim()} className="w-full sm:w-auto h-9 min-w-[120px] text-xs">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
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

        {/* Quick Links Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1 sm:pt-2">
          {hasPermission(["farm.view", "farm.edit", "farm.delete"]) && (
            <Link href="/farm" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <Layers className="h-4 w-4 text-emerald-600 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Manage Farm</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission(["farm.production.view", "farm.production.create"]) && (
            <Link href="/farm/production" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <PlusCircle className="h-4 w-4 text-amber-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Production</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission(["farm.delivery.view", "farm.delivery.create"]) && (
            <Link href="/farm/delivery" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <Truck className="h-4 w-4 text-blue-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Delivery</span>
                </div>
              </Card>
            </Link>
          )}
          {hasPermission("farm.report") && (
            <Link href="/farm/report" className="block">
              <Card className="hover:border-primary/50 transition-colors p-2 sm:p-3 text-center border border-border h-14 sm:h-auto flex items-center justify-center">
                <div className="flex items-center sm:flex-col gap-1.5 sm:gap-1">
                  <BarChart3 className="h-4 w-4 text-indigo-500 shrink-0 sm:mx-auto" />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Report</span>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </HasPermission>
  );
}
