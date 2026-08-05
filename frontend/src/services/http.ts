import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

export const http = {
  get: <T>(url: string, params?: Record<string, any>) =>
    apiClient<T>(url, { method: "GET", params }),

  post: <T>(url: string, body?: any) =>
    apiClient<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(url: string, body?: any) =>
    apiClient<T>(url, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(url: string, body?: any) =>
    apiClient<T>(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string) => apiClient<T>(url, { method: "DELETE" }),
};
