"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserCheck, Trash2, Edit, Shield, Phone, Mail, Filter } from "lucide-react";
import { userService, roleService } from "@/services/api";
import { UserItem, RoleItem } from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { AddUserModal } from "@/components/users/add-user-modal";
import { EditUserModal } from "@/components/users/edit-user-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/utils/formatters";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { user: currentUser } = useAuth();

  // Fetch Roles for dropdown filter & modals
  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getRoles(),
  });
  const roles: RoleItem[] = (rolesData?.data || []).filter(r => {
    if (currentUser?.role?.code === "admin" && r.code === "owner") return false;
    return true;
  });

  // Fetch Paginated Users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users", page, debouncedSearch, selectedRole, selectedStatus],
    queryFn: () =>
      userService.getUsers({
        page,
        size: 10,
        search: debouncedSearch || undefined,
        role_id: selectedRole || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const users: UserItem[] = (usersData?.data?.items || []).filter(u => {
    if (currentUser?.role?.code === "admin" && u.role?.code === "owner") return false;
    return true;
  });
  const totalPages = usersData?.data?.pages || 1;
  const pageSize = 10;

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => userService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleDelete = async (user: UserItem) => {
    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage system user accounts, assigned roles, contact profiles, and security access statuses."
        action={
          <HasPermission code="user.create">
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </HasPermission>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, username, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Directory Table */}
      <Card className="glass-card overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 align-middle w-12 text-center whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">User Details</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Role</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Contact</th>
                <th className="px-3 py-2.5 align-middle w-[110px] whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 align-middle whitespace-nowrap">Created Date</th>
                <th className="px-3 py-2.5 align-middle w-[120px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-10">
                    <td className="px-3 py-2 align-middle text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No system users match your search criteria.
                  </td>
                </tr>
              ) : (
                users.map((user, index) => {
                  const serialNumber = (page - 1) * pageSize + index + 1;

                  return (
                    <tr key={user.id} className="hover:bg-accent/40 transition-colors h-10">
                      <td className="px-3 py-2 align-middle text-center font-medium text-muted-foreground whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="font-semibold text-foreground">{user.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">@{user.username}</div>
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge variant={user.role?.code === "owner" ? "default" : "outline"} className="capitalize text-[10px] py-0 px-2 h-5">
                          <Shield className="mr-1 h-3 w-3" />
                          {user.role?.name || "Unassigned"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
                        {user.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{user.phone || "-"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <Badge
                          variant={
                            user.status === "active"
                              ? "success"
                              : user.status === "suspended"
                              ? "destructive"
                              : "secondary"
                          }
                          className="capitalize text-[10px] py-0 px-2 h-5"
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">{formatDate(user.created_at)}</td>
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap space-x-1">
                        <HasPermission code="user.edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingUser(user)}
                            title="Edit User"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermission>
                        <HasPermission code="user.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user)}
                            title="Delete User"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermission>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
        roles={roles}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
        roles={roles}
      />
    </div>
  );
}
