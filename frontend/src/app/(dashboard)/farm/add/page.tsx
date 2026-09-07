'use client';

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sprout, Plus, Loader2, Layers, Truck, PlusCircle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { farmService } from "@/services/api";

export default function AddFarmPage() {
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Farm</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Create a new farm location. It will immediately be available in Production and Delivery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/farm">
            <Button variant="outline" size="sm" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Manage Farm
            </Button>
          </Link>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">
            New Farm
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enter the farm name below to create a new farm.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="farmName" className="text-sm font-medium text-foreground">
                Farm Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="farmName"
                type="text"
                placeholder="e.g. Akota Poultry Farm"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                disabled={submitting}
                className="text-sm h-10"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                After adding, you can configure starting trays in Manage Farm.
              </p>
              <Button type="submit" disabled={submitting || !farmName.trim()} className="min-w-[120px]">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <Link href="/farm" className="block">
          <Card className="hover:border-primary/50 transition-colors p-3 text-center border border-border">
            <Layers className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <span className="text-xs font-medium text-foreground">Manage Farm</span>
          </Card>
        </Link>
        <Link href="/farm/production" className="block">
          <Card className="hover:border-primary/50 transition-colors p-3 text-center border border-border">
            <PlusCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <span className="text-xs font-medium text-foreground">Production</span>
          </Card>
        </Link>
        <Link href="/farm/delivery" className="block">
          <Card className="hover:border-primary/50 transition-colors p-3 text-center border border-border">
            <Truck className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <span className="text-xs font-medium text-foreground">Delivery</span>
          </Card>
        </Link>
        <Link href="/farm/report" className="block">
          <Card className="hover:border-primary/50 transition-colors p-3 text-center border border-border">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
            <span className="text-xs font-medium text-foreground">Report</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
