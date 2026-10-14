"use client";

import { useAuth } from "@/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";
import SettingsPage from "../page";

export default function StockReportSettingsPage() {
  const { user, hasPermission, isLoading } = useAuth();
  const isOwner = user?.role?.code === "owner";
  const canEdit = isOwner || hasPermission("settings.edit");

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto mt-20 flex flex-col items-center justify-center p-8 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Verifying authorizations...</span>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="glass-card text-center p-8 border-destructive/20 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mt-2">
            You do not have permission to access Stock Report settings.
          </p>
        </Card>
      </div>
    );
  }

  return <SettingsPage defaultTab="stock-report" />;
}
