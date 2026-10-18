"use client";

import { useEffect, useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Save,
  ShieldCheck,
  CheckSquare,
  Square,
  Search,
  X,
  Lock,
  Trash2,
} from "lucide-react";
import { roleService } from "@/services/api";
import { PermissionItem, RoleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface RolePermissionMatrixProps {
  role: RoleItem;
  allPermissions: PermissionItem[];
  onSaved?: () => void;
  onDeleteRole?: () => void;
}

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  dashboard_filtered: "Filtered Dashboard",
  reports: "Reports Center",
  stock_report: "Stock Report",
  cash_report: "Daily Cash Report",
  cash_out_report: "Cash Out Report",
  role: "Roles & Permissions",
  user: "User Management",
  sales: "Sales",
  sale_return: "Sale Returns",
  customer: "Customers",
  collection: "Customer Collections",
  product: "Products",
  supplier: "Suppliers",
  supplier_payment: "Supplier Payments",
  purchase: "Purchases",
  product_return: "Purchase Returns",
  expense: "Expenses",
  cash_out: "Cash Out Vouchers",
  accounts: "Accounts & Ledger",
  farm: "Farm Operations",
  calculator: "Calculators",
  profile: "User Profile",
  settings: "System Settings",
};

const MODULE_ORDER = [
  "dashboard",
  "dashboard_filtered",
  "reports",
  "stock_report",
  "cash_report",
  "cash_out_report",
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
  "cash_out",
  "accounts",
  "farm",
  "calculator",
  "profile",
  "settings",
];

const FARM_SUBGROUPS = [
  {
    title: "Farm Management",
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

const ACTION_ORDER = [
  "view",
  "list",
  "read",
  "create",
  "add",
  "edit",
  "update",
  "delete",
  "report",
  "print",
  "export",
  "import",
];

function sortPermissions(perms: PermissionItem[]): PermissionItem[] {
  const getActionScore = (code: string) => {
    const parts = code.split(".");
    const action = parts[parts.length - 1].toLowerCase();
    const idx = ACTION_ORDER.indexOf(action);
    return idx !== -1 ? idx : 90;
  };

  return [...perms].sort((a, b) => {
    const scoreA = getActionScore(a.code);
    const scoreB = getActionScore(b.code);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.name.localeCompare(b.name);
  });
}

export function RolePermissionMatrix({ role, allPermissions, onSaved, onDeleteRole }: RolePermissionMatrixProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = role.code === "owner";
  const isCustomRole = !role.is_system && !["owner", "admin", "employee"].includes(role.code);

  useEffect(() => {
    if (role && role.permissions) {
      setSelectedIds(role.permissions.map((p) => p.id));
    }
  }, [role]);

  // Filter out obsolete permissions like farm.waste
  const validPermissions = useMemo(() => {
    return allPermissions.filter((p) => p.code !== "farm.waste");
  }, [allPermissions]);

  // Check if modified compared to initial
  const initialIds = useMemo(() => {
    return (role.permissions || []).map((p) => p.id);
  }, [role]);

  const isDirty = useMemo(() => {
    if (isOwner) return false;
    if (selectedIds.length !== initialIds.length) return true;
    const initialSet = new Set(initialIds);
    return selectedIds.some((id) => !initialSet.has(id));
  }, [isOwner, selectedIds, initialIds]);

  // Group permissions by module in priority order
  const distinctModules = useMemo(() => {
    const mods = Array.from(new Set(validPermissions.map((p) => p.module)));
    return mods.sort((a, b) => {
      const idxA = MODULE_ORDER.indexOf(a);
      const idxB = MODULE_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [validPermissions]);

  const permissionsByModule = useMemo(() => {
    return distinctModules.reduce((acc, mod) => {
      acc[mod] = validPermissions.filter((p) => p.module === mod);
      return acc;
    }, {} as Record<string, PermissionItem[]>);
  }, [distinctModules, validPermissions]);

  // Search filtering
  const searchNormalized = searchQuery.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (!searchNormalized) return distinctModules;

    return distinctModules.filter((mod) => {
      const modDisplayName = (MODULE_DISPLAY_NAMES[mod] || mod).toLowerCase();
      if (modDisplayName.includes(searchNormalized) || mod.toLowerCase().includes(searchNormalized)) {
        return true;
      }
      const perms = permissionsByModule[mod] || [];
      return perms.some(
        (p) =>
          p.name.toLowerCase().includes(searchNormalized) ||
          p.code.toLowerCase().includes(searchNormalized)
      );
    });
  }, [distinctModules, searchNormalized, permissionsByModule]);

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
    if (isOwner) return; // Owner permissions immutable
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePermissionGroup = (permIds: string[]) => {
    if (isOwner) return;
    const allSelected = permIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !permIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...permIds])));
    }
  };

  const toggleModuleAll = (moduleName: string) => {
    if (isOwner) return;
    const modulePermIds = (permissionsByModule[moduleName] || []).map((p) => p.id);
    togglePermissionGroup(modulePermIds);
  };

  const selectAll = () => {
    if (isOwner) return;
    setSelectedIds(validPermissions.map((p) => p.id));
  };

  const clearAll = () => {
    if (isOwner) return;
    setSelectedIds([]);
  };

  const totalSelectedCount = isOwner ? validPermissions.length : selectedIds.length;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xs rounded-2xl overflow-hidden">
      {/* Header & Controls */}
      <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/10 space-y-4">
        {/* Top Bar: Title + Badges + Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Role Header Info */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Permission Matrix: <span className="text-primary">{role.name}</span>
              </h2>

              {isOwner ? (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-[11px] font-semibold rounded-lg"
                >
                  <Lock className="h-3 w-3" />
                  System Immutable
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] font-semibold rounded-lg">
                  {role.is_system ? "System Role" : "Custom Role"}
                </Badge>
              )}

              <Badge
                variant={isOwner || selectedIds.length > 0 ? "secondary" : "outline"}
                className="text-[11px] font-semibold font-mono rounded-lg"
              >
                {isOwner
                  ? `${validPermissions.length} / ${validPermissions.length} All Active`
                  : `${totalSelectedCount} / ${validPermissions.length} Selected`}
              </Badge>

              {isDirty && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 animate-pulse rounded-lg"
                >
                  Unsaved Changes
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {isOwner
                ? "Owner role has absolute unconstrained access to all system modules. Permissions cannot be modified."
                : `Configure operational module and feature access assigned to the ${role.name} role.`}
            </p>
          </div>

          {/* Action Buttons for non-owners */}
          {!isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              {isCustomRole && onDeleteRole && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDeleteRole}
                  className="h-8 px-2.5 text-xs rounded-xl font-medium text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-destructive/20"
                  title="Delete this custom role"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Role
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="h-8 px-2.5 text-xs rounded-xl font-medium"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="h-8 px-2.5 text-xs rounded-xl font-medium"
              >
                Clear All
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveMutation.mutate(selectedIds)}
                disabled={saveMutation.isPending}
                className={`h-8 px-3.5 text-xs rounded-xl font-semibold shadow-2xs transition-all ${
                  isDirty
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : ""
                }`}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search permissions or modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8.5 pr-8 h-8.5 text-xs bg-background/80 border-border/70 rounded-xl w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Alerts */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>Role permissions updated successfully!</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Empty Search Result State */}
        {filteredModules.length === 0 && (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-foreground">No permissions found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No modules or permissions match &quot;{searchQuery}&quot;. Try a different keyword or clear your search.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-3.5 h-8 text-xs rounded-xl"
            >
              Clear Search
            </Button>
          </div>
        )}

        {/* Modules Render */}
        {filteredModules.map((moduleName) => {
          const rawPerms = permissionsByModule[moduleName] || [];
          const modulePermIds = rawPerms.map((p) => p.id);
          const isModuleFull = modulePermIds.length > 0 && modulePermIds.every((id) => selectedIds.includes(id));
          const selectedInModuleCount = modulePermIds.filter((id) => selectedIds.includes(id)).length;

          // If searching, filter display perms
          let displayPerms = rawPerms;
          if (searchNormalized) {
            const modMatches =
              (MODULE_DISPLAY_NAMES[moduleName] || moduleName).toLowerCase().includes(searchNormalized) ||
              moduleName.toLowerCase().includes(searchNormalized);

            if (!modMatches) {
              displayPerms = rawPerms.filter(
                (p) =>
                  p.name.toLowerCase().includes(searchNormalized) ||
                  p.code.toLowerCase().includes(searchNormalized)
              );
            }
          }

          if (displayPerms.length === 0) return null;

          // Sort permissions in standard order
          const sortedDisplayPerms = sortPermissions(displayPerms);

          const moduleDisplayName =
            MODULE_DISPLAY_NAMES[moduleName] ||
            moduleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div
              key={moduleName}
              className="border border-border/60 rounded-2xl p-3.5 sm:p-4 bg-muted/10 space-y-3 shadow-2xs"
            >
              {/* Module Header (single-line, wrap-safe) */}
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                    {moduleDisplayName}
                  </span>
                  <Badge
                    variant={isOwner || isModuleFull ? "default" : selectedInModuleCount > 0 ? "secondary" : "outline"}
                    className="text-[10px] font-mono px-1.5 py-0 rounded-md font-semibold shrink-0"
                  >
                    {isOwner ? `${rawPerms.length} / ${rawPerms.length}` : `${selectedInModuleCount} / ${rawPerms.length}`}
                  </Badge>
                </div>

                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => toggleModuleAll(moduleName)}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 shrink-0"
                  >
                    {isModuleFull ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>Deselect</span>
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Module Body: Farm Subgroups vs Standard Grid */}
              {moduleName === "farm" ? (
                <div className="space-y-4 pt-1">
                  {FARM_SUBGROUPS.map((group) => {
                    const groupRawPerms = rawPerms.filter((p) => group.match(p.code));
                    if (groupRawPerms.length === 0) return null;

                    const groupPermIds = groupRawPerms.map((p) => p.id);
                    const isGroupFull =
                      groupPermIds.length > 0 && groupPermIds.every((id) => selectedIds.includes(id));
                    const selectedInGroupCount = groupPermIds.filter((id) => selectedIds.includes(id)).length;

                    // Filter for search
                    let groupDisplayPerms = groupRawPerms;
                    if (searchNormalized) {
                      const groupMatches =
                        group.title.toLowerCase().includes(searchNormalized) ||
                        moduleDisplayName.toLowerCase().includes(searchNormalized);

                      if (!groupMatches) {
                        groupDisplayPerms = groupRawPerms.filter(
                          (p) =>
                            p.name.toLowerCase().includes(searchNormalized) ||
                            p.code.toLowerCase().includes(searchNormalized)
                        );
                      }
                    }

                    if (groupDisplayPerms.length === 0) return null;

                    const sortedGroupPerms = sortPermissions(groupDisplayPerms);

                    return (
                      <div
                        key={group.title}
                        className="space-y-2.5 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground/85 tracking-wide uppercase">
                              {group.title}
                            </span>
                            <Badge
                              variant={
                                isOwner || isGroupFull
                                  ? "default"
                                  : selectedInGroupCount > 0
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[9px] font-mono px-1.5 py-0 rounded font-semibold shrink-0"
                            >
                              {isOwner
                                ? `${groupRawPerms.length} / ${groupRawPerms.length}`
                                : `${selectedInGroupCount} / ${groupRawPerms.length}`}
                            </Badge>
                          </div>

                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => togglePermissionGroup(groupPermIds)}
                              className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 shrink-0"
                            >
                              {isGroupFull ? (
                                <>
                                  <CheckSquare className="h-3 w-3" />
                                  <span>Deselect</span>
                                </>
                              ) : (
                                <>
                                  <Square className="h-3 w-3" />
                                  <span>Select All</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                          {sortedGroupPerms.map((perm) => {
                            const isChecked = isOwner || selectedIds.includes(perm.id);

                            return (
                              <label
                                key={perm.id}
                                className={`group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? "bg-primary/10 border-primary/40 text-foreground shadow-2xs"
                                    : "bg-background/60 hover:bg-muted/40 border-border/70 text-muted-foreground"
                                } ${isOwner ? "cursor-default opacity-85" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(perm.id)}
                                  className="mt-0.5 rounded border-border text-primary focus:ring-primary/20 h-4 w-4 shrink-0 transition-transform group-active:scale-95"
                                />
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div
                                    className="font-semibold text-foreground text-xs leading-snug line-clamp-1"
                                    title={perm.name}
                                  >
                                    {perm.name}
                                  </div>
                                  <div
                                    className="text-[10px] font-mono text-muted-foreground/60 truncate"
                                    title={perm.code}
                                  >
                                    {perm.code}
                                  </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                  {sortedDisplayPerms.map((perm) => {
                    const isChecked = isOwner || selectedIds.includes(perm.id);

                    return (
                      <label
                        key={perm.id}
                        className={`group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? "bg-primary/10 border-primary/40 text-foreground shadow-2xs"
                            : "bg-background/60 hover:bg-muted/40 border-border/70 text-muted-foreground"
                        } ${isOwner ? "cursor-default opacity-85" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isOwner}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary/20 h-4 w-4 shrink-0 transition-transform group-active:scale-95"
                        />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div
                            className="font-semibold text-foreground text-xs leading-snug line-clamp-1"
                            title={perm.name}
                          >
                            {perm.name}
                          </div>
                          <div
                            className="text-[10px] font-mono text-muted-foreground/60 truncate"
                            title={perm.code}
                          >
                            {perm.code}
                          </div>
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
