"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, Users, Key, CheckCircle2, Trash2 } from "lucide-react";
import { permissionService, roleService } from "@/services/api";
import { PermissionItem, RoleItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { RolePermissionMatrix } from "@/components/roles/role-permission-matrix";
import { AddRoleModal } from "@/components/roles/add-role-modal";
import { DeleteRoleModal } from "@/components/roles/delete-role-modal";

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);

  const { user: currentUser, hasPermission } = useAuth();

  // Fetch Roles
  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getRoles(),
    enabled: hasPermission("role.view"),
  });

  const roles: RoleItem[] = (rolesData?.data || []).filter((r) => {
    if (currentUser?.role?.code === "admin" && r.code === "owner") return false;
    return true;
  });

  // Fetch System Permissions
  const { data: permsData, isLoading: isLoadingPerms } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionService.getPermissions(),
    enabled: hasPermission("role.view"),
  });
  const allPermissions: PermissionItem[] = permsData?.data || [];

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  return (
    <HasPermission
      code="role.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to view Roles & Permissions.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Role & Permission Management"
          description="Manage system roles (Owner, Admin, Employee) and configure dynamic permission matrices."
          action={
            <HasPermission code="role.edit">
              <Button onClick={() => setIsAddOpen(true)} className="rounded-xl shadow-xs">
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Role
              </Button>
            </HasPermission>
          }
        />

        {/* Role Selector Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {isLoadingRoles ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            roles.map((role) => {
              const isSelected = activeRole?.id === role.id;
              const isCustom = !role.is_system && !["owner", "admin", "employee"].includes(role.code);

              return (
                <Card
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`cursor-pointer transition-all duration-200 rounded-2xl border ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/25"
                      : "border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 shadow-xs"
                  }`}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm sm:text-base font-bold truncate">
                        {role.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {role.is_system ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">
                          System Role
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
                          Custom
                        </Badge>
                      )}

                      {/* Delete Custom Role Button */}
                      {isCustom && (
                        <HasPermission code="role.edit">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingRole(role);
                            }}
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={`Delete custom role "${role.name}"`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </HasPermission>
                      )}

                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-2.5">
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                      {role.description || "No description provided for this role."}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium">{role.user_count || 0} Users</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <Key className="h-3 w-3 text-muted-foreground/70" />
                        <span className="font-semibold">
                          {role.code === "owner" ? "ALL" : `${role.permissions?.length || 0} Perms`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Role Permission Matrix Editor */}
        {activeRole && (
          <HasPermission code="role.view">
            <RolePermissionMatrix
              role={activeRole}
              allPermissions={allPermissions}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["roles"] })}
              onDeleteRole={() => setDeletingRole(activeRole)}
            />
          </HasPermission>
        )}

        {/* Add Custom Role Modal */}
        <AddRoleModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["roles"] })}
        />

        {/* Delete Custom Role Confirmation Modal */}
        <DeleteRoleModal
          isOpen={!!deletingRole}
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onSuccess={() => {
            if (selectedRoleId === deletingRole?.id) {
              const remaining = roles.filter((r) => r.id !== deletingRole?.id);
              setSelectedRoleId(remaining[0]?.id || null);
            }
            queryClient.invalidateQueries({ queryKey: ["roles"] });
          }}
        />
      </div>
    </HasPermission>
  );
}
