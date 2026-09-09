"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserCheck, Trash2, Edit, Shield, Phone, Mail, Filter, Key, Copy, Check } from "lucide-react";
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
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

function UserAvatar({ name, url }: { name: string; url?: string | null }) {
  const [error, setError] = useState(false);
  const initials = (name || "U").slice(0, 2).toUpperCase();

  if (url && !error) {
    return (
      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0">
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
      {initials}
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [recoveryModalData, setRecoveryModalData] = useState<{
    user: UserItem;
    recoveryCode: string;
  } | null>(null);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.role?.code === "owner";

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
      toast.success("User deleted successfully");
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete user.";
      toast.error(msg);
      setDeletingUser(null);
    }
  });

  // Enable Recovery Mode Mutation
  const enableRecoveryMutation = useMutation({
    mutationFn: (userId: string) => userService.enableRecoveryMode(userId),
    onSuccess: (res, userId) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      const target = users.find((u) => u.id === userId);
      if (target && res.data?.recovery_code) {
        setRecoveryModalData({
          user: target,
          recoveryCode: res.data.recovery_code,
        });
        setHasCopiedCode(false);
      }
      toast.success("Recovery mode enabled successfully");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to enable recovery mode.";
      toast.error(msg);
    },
  });

  // Disable Recovery Mode Mutation
  const disableRecoveryMutation = useMutation({
    mutationFn: (userId: string) => userService.disableRecoveryMode(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Recovery mode disabled successfully");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to disable recovery mode.";
      toast.error(msg);
    },
  });

  const handleToggleRecovery = (targetUser: UserItem) => {
    if (targetUser.recovery_mode_enabled) {
      disableRecoveryMutation.mutate(targetUser.id);
    } else {
      enableRecoveryMutation.mutate(targetUser.id);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setHasCopiedCode(true);
    toast.success("Recovery code copied to clipboard!");
    setTimeout(() => setHasCopiedCode(false), 3000);
  };

  const handleDeleteConfirm = async () => {
    if (deletingUser) {
      deleteMutation.mutate(deletingUser.id);
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
                {isOwner && (
                  <th className="px-3 py-2.5 align-middle whitespace-nowrap">Recovery Mode</th>
                )}
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
                    {isOwner && <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-20" /></td>}
                    <td className="px-3 py-2 align-middle"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2 align-middle text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 8 : 7} className="p-8 text-center text-muted-foreground">
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
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.full_name || user.username} url={user.profile_logo_url} />
                          <div>
                            <div className="font-semibold text-foreground">{user.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
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
                      {isOwner && (
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                user.recovery_mode_enabled
                                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] py-0 px-2 h-5 font-semibold"
                                  : "text-[10px] py-0 px-2 h-5 text-muted-foreground"
                              }
                            >
                              {user.recovery_mode_enabled ? "ON" : "OFF"}
                            </Badge>
                            <Button
                              variant={user.recovery_mode_enabled ? "secondary" : "outline"}
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              disabled={enableRecoveryMutation.isPending || disableRecoveryMutation.isPending}
                              onClick={() => handleToggleRecovery(user)}
                              title={user.recovery_mode_enabled ? "Disable Recovery Mode" : "Enable Recovery Mode"}
                            >
                              {user.recovery_mode_enabled ? "Turn OFF" : "Turn ON"}
                            </Button>
                          </div>
                        </td>
                      )}
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
                            onClick={() => setDeletingUser(user)}
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

      {/* Delete User Modal */}
      {deletingUser && (
        <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Delete User
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to delete the user <strong className="text-foreground">{deletingUser.username}</strong>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingUser(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Recovery Code Dialog for Owner */}
      {recoveryModalData && (
        <Dialog open={!!recoveryModalData} onOpenChange={(open) => !open && setRecoveryModalData(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Key className="h-5 w-5 text-amber-500" /> Recovery Mode Enabled
              </DialogTitle>
              <DialogDescription className="pt-2">
                Recovery mode is now active for <strong className="text-foreground">@{recoveryModalData.user.username}</strong>.
                Share this one-time recovery code with the user to verify on the login page.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                One-Time Recovery Code (Single-Use, 30 Min Expiry)
              </label>
              <div className="flex items-center gap-2 bg-muted/60 p-3 rounded-lg border">
                <code className="font-mono text-base font-bold tracking-widest text-primary flex-1 select-all">
                  {recoveryModalData.recoveryCode}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => handleCopyCode(recoveryModalData.recoveryCode)}
                >
                  {hasCopiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {hasCopiedCode ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Once the user successfully resets their password, Recovery Mode will automatically turn OFF.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => setRecoveryModalData(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
