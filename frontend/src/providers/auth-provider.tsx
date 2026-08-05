"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/api";
import { LoginRequest, UserItem } from "@/types";

interface AuthContextType {
  user: UserItem | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserItem | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await authService.getMe();
      if (res.success && res.data) {
        setUser(res.data.user);
        setPermissions(res.data.permissions || []);
      } else {
        setUser(null);
        setPermissions([]);
      }
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await authService.login(credentials);
    if (res.success && res.data) {
      if (typeof window !== "undefined" && res.data.access_token) {
        localStorage.setItem("auth_token", res.data.access_token);
      }
      setUser(res.data.user);
      setPermissions(res.data.permissions || []);
      router.push("/");
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout API error
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
      setUser(null);
      setPermissions([]);
      router.push("/login");
    }
  }, [router]);

  const hasPermission = useCallback((code: string | string[]): boolean => {
    if (!user) return false;
    if (user.role?.code === "owner") return true;

    const required = Array.isArray(code) ? code : [code];
    return required.some((perm) => permissions.includes(perm));
  }, [user, permissions]);

  const contextValue = useMemo(() => ({
    user,
    permissions,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    hasPermission,
  }), [user, permissions, isLoading, login, logout, hasPermission]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function HasPermission({
  code,
  children,
  fallback = null,
}: {
  code: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  return hasPermission(code) ? <>{children}</> : <>{fallback}</>;
}
