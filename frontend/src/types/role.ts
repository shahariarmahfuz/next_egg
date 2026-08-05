import { PermissionItem } from "./permission";

export interface RoleItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  permissions: PermissionItem[];
  user_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionAssignPayload {
  permission_ids: string[];
}
