"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, ShieldCheck, Users, Lock, Key } from "lucide-react";
import { permissionService, roleService } from "@/services/api";
import { PermissionItem, RoleItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { RolePermissionMatrix } from "@/components/roles/role-permission-matrix";
import { AddRoleModal } from "@/components/roles/add-role-modal";

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Fetch Roles
  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getRoles(),
  });
  const { user: currentUser } = useAuth();

  const roles: RoleItem[] = (rolesData?.data || []).filter(r => {
    if (currentUser?.role?.code === "admin" && r.code === "owner") return false;
    return true;
  });

  // Fetch System Permissions
  const { data: permsData, isLoading: isLoadingPerms } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionService.getPermissions(),
  });
  const allPermissions: PermissionItem[] = permsData?.data || [];

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Role & Permission Management"
        description="Manage system roles (Owner, Admin, Employee) and configure dynamic permission matrices."
        action={
          <HasPermission code="role.edit">
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Role
            </Button>
          </HasPermission>
        }
      />

      {/* Role Selector Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoadingRoles ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          roles.map((role) => {
            const isSelected = activeRole?.id === role.id;

            return (
              <Card
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                    : "glass-card hover:border-primary/40"
                }`}
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <CardTitle className="text-base font-bold">{role.name}</CardTitle>
                  </div>
                  {role.is_system ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      System Role
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Custom
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{role.user_count || 0} Users</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Key className="h-3 w-3" />
                      <span>
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
          />
        </HasPermission>
      )}

      {/* Add Custom Role Modal */}
      <AddRoleModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["roles"] })}
      />
    </div>
  );
}
