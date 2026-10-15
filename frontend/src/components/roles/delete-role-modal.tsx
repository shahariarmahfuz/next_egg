"use client";

import { useState } from "react";
import { Loader2, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { roleService } from "@/services/api";
import { RoleItem } from "@/types";
import { Button } from "@/components/ui/button";

interface DeleteRoleModalProps {
  isOpen: boolean;
  role: RoleItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteRoleModal({ isOpen, role, onClose, onSuccess }: DeleteRoleModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !role) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setErrorMsg(null);
      await roleService.deleteRole(role.id);
      toast.success(`Role "${role.name}" deleted successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete role.");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasUsers = (role.user_count || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-md bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground leading-none">Delete Custom Role</h3>
              <p className="text-xs text-muted-foreground mt-1">This action cannot be undone.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <p className="text-sm text-foreground">
            Are you sure you want to permanently delete the custom role{" "}
            <span className="font-bold text-destructive underline underline-offset-2">
              &quot;{role.name}&quot;
            </span>{" "}
            (<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{role.code}</code>)?
          </p>

          {hasUsers ? (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Active Users Notice</span>
              </div>
              <p className="text-muted-foreground dark:text-amber-300/80 leading-relaxed pl-6">
                This role is currently assigned to <strong className="text-foreground">{role.user_count} user(s)</strong>.
                Deleting it will safely reassign them to the default <strong className="text-foreground">Employee</strong> role so their accounts remain active.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs text-muted-foreground">
              No users are currently assigned to this role. It can be safely removed immediately.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl h-9 text-xs font-semibold shadow-xs"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Role
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
