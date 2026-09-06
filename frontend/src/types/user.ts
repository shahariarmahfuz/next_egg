import { RoleItem } from "./role";

export interface UserItem {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  phone?: string;
  role_id: string;
  role?: RoleItem;
  status: "active" | "inactive" | "suspended";
  profile_logo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreatePayload {
  full_name: string;
  username: string;
  email?: string;
  phone?: string;
  password: string;
  role_id: string;
  status: string;
  profile_logo_url?: string | null;
}

export interface UserUpdatePayload {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role_id?: string;
  status?: string;
  profile_logo_url?: string | null;
}

export interface UserProfileUpdatePayload {
  full_name?: string;
  profile_logo_url?: string | null;
}
