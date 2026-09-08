"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save, ShieldCheck, CheckSquare, Square } from "lucide-react";
import { roleService } from "@/services/api";
import { PermissionItem, RoleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RolePermissionMatrixProps {
  role: RoleItem;
  allPermissions: PermissionItem[];
  onSaved?: () => void;
}

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  dashboard_filtered: "Filtered Dashboard",
  reports: "Reports Center",
  role: "Role & Permission Management",
  user: "User Management",
  sales: "Sales",
  sale_return: "Sale Return",
  customer: "Customer",
  collection: "Customer Collection",
  product: "Product",
  supplier: "Supplier",
  supplier_payment: "Supplier Payment",
  purchase: "Purchase",
  product_return: "Product Return",
  expense: "Expense",
  farm: "Farm",
  profile: "User Profile",
  settings: "Settings",
};

const MODULE_ORDER = [
  "dashboard",
  "dashboard_filtered",
  "reports",
  "role",
  "user",
  "sales",
  "sale_return",
  "customer",
  "collection",
  "product",
  "supplier",
  "supplier_payment",
  "purchase",
  "product_return",
  "expense",
  "farm",
  "profile",
  "settings",
];

const FARM_SUBGROUPS = [
  {
    title: "Farm",
    order: ["farm.view", "farm.create", "farm.edit", "farm.delete"],
    match: (code: string) =>
      ["farm.view", "farm.create", "farm.edit", "farm.delete"].includes(code) ||
      (code.startsWith("farm.") &&
        !code.startsWith("farm.production.") &&
        !code.startsWith("farm.delivery.") &&
        code !== "farm.report" &&
        code !== "farm.waste"),
  },
  {
    title: "Production",
    order: [
      "farm.production.view",
      "farm.production.create",
      "farm.production.edit",
      "farm.production.delete",
    ],
    match: (code: string) => code.startsWith("farm.production."),
  },
  {
    title: "Delivery",
    order: [
      "farm.delivery.view",
      "farm.delivery.create",
      "farm.delivery.edit",
      "farm.delivery.delete",
    ],
    match: (code: string) => code.startsWith("farm.delivery."),
  },
  {
    title: "Reports",
    order: ["farm.report"],
    match: (code: string) => code === "farm.report",
  },
];

export function RolePermissionMatrix({ role, allPermissions, onSaved }: RolePermissionMatrixProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (role && role.permissions) {
      setSelectedIds(role.permissions.map((p) => p.id));
    }
  }, [role]);

  // Filter out obsolete permissions like farm.waste
  const validPermissions = allPermissions.filter((p) => p.code !== "farm.waste");

  // Group permissions by module in priority order
  const distinctModules = Array.from(new Set(validPermissions.map((p) => p.module)));
  const modules = distinctModules.sort((a, b) => {
    const idxA = MODULE_ORDER.indexOf(a);
    const idxB = MODULE_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const permissionsByModule = modules.reduce((acc, mod) => {
    acc[mod] = validPermissions.filter((p) => p.module === mod);
    return acc;
  }, {} as Record<string, PermissionItem[]>);

  const saveMutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      roleService.updateRolePermissions(role.id, { permission_ids: permissionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
      if (onSaved) onSaved();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update role permissions");
    },
  });

  const togglePermission = (id: string) => {
    if (role.code === "owner") return; // Owner permissions immutable
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePermissionGroup = (permIds: string[]) => {
    if (role.code === "owner") return;
    const allSelected = permIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !permIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...permIds])));
    }
  };

  const toggleModuleAll = (moduleName: string) => {
    if (role.code === "owner") return;
    const modulePermIds = permissionsByModule[moduleName].map((p) => p.id);
    togglePermissionGroup(modulePermIds);
  };

  const selectAll = () => {
    if (role.code === "owner") return;
    setSelectedIds(validPermissions.map((p) => p.id));
  };

  const clearAll = () => {
    if (role.code === "owner") return;
    setSelectedIds([]);
  };

  const isOwner = role.code === "owner";

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Permission Matrix: {role.name}</CardTitle>
          </div>
          <CardDescription>
            {isOwner
              ? "Owner retains full unconstrained access to all system modules."
              : `Configure granular operational permissions assigned to the ${role.name} role.`}
          </CardDescription>
        </div>

        {!isOwner && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
            <Button
              onClick={() => saveMutation.mutate(selectedIds)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Role permissions updated successfully!</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs">
            {errorMsg}
          </div>
        )}

        {modules.map((moduleName) => {
          const perms = permissionsByModule[moduleName];
          const modulePermIds = perms.map((p) => p.id);
          const isModuleFull = modulePermIds.every((id) => selectedIds.includes(id));

          return (
            <div key={moduleName} className="border rounded-xl p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                    {MODULE_DISPLAY_NAMES[moduleName] || moduleName.replace(/_/g, " ")} Module
                  </Badge>
                  <span className="text-xs text-muted-foreground">({perms.length} permissions)</span>
                </div>

                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => toggleModuleAll(moduleName)}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {isModuleFull ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" />
                        Deselect Module
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" />
                        Select All in Module
                      </>
                    )}
                  </button>
                )}
              </div>

              {moduleName === "farm" ? (
                <div className="space-y-4 pt-1">
                  {FARM_SUBGROUPS.map((group) => {
                    const groupPerms = perms
                      .filter((p) => group.match(p.code))
                      .sort((a, b) => {
                        const idxA = group.order.indexOf(a.code);
                        const idxB = group.order.indexOf(b.code);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.code.localeCompare(b.code);
                      });

                    if (groupPerms.length === 0) return null;

                    const groupPermIds = groupPerms.map((p) => p.id);
                    const isGroupFull = groupPermIds.every((id) => selectedIds.includes(id));

                    return (
                      <div
                        key={group.title}
                        className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground/80 tracking-wide uppercase">
                            {group.title}
                          </span>
                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => togglePermissionGroup(groupPermIds)}
                              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              {isGroupFull ? (
                                <>
                                  <CheckSquare className="h-3 w-3" />
                                  Deselect {group.title}
                                </>
                              ) : (
                                <>
                                  <Square className="h-3 w-3" />
                                  Select {group.title}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {groupPerms.map((perm) => {
                            const isChecked = isOwner || selectedIds.includes(perm.id);

                            return (
                              <label
                                key={perm.id}
                                className={`flex items-start space-x-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-primary/10 border-primary/40 text-foreground"
                                    : "bg-background/50 border-border text-muted-foreground hover:bg-accent/40"
                                } ${isOwner ? "cursor-not-allowed opacity-80" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(perm.id)}
                                  className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4"
                                />
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-foreground">{perm.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{perm.code}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {perms.map((perm) => {
                    const isChecked = isOwner || selectedIds.includes(perm.id);

                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "bg-background/50 border-border text-muted-foreground hover:bg-accent/40"
                        } ${isOwner ? "cursor-not-allowed opacity-80" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isOwner}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">{perm.name}</div>
                          <div className="text-[10px] text-muted-foreground">{perm.code}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
