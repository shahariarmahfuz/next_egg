import { env } from "./env";
import { ApiResponse } from "@/types/api";

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  token?: string;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { params, token, headers, ...customConfig } = options;

  let baseUrl = env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      baseUrl = "/api/v1";
    }
  } else if (process.env.SERVER_API_URL) {
    baseUrl = process.env.SERVER_API_URL;
  }

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  } else if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      defaultHeaders["Authorization"] = `Bearer ${storedToken}`;
    }
  }

  const config: RequestInit = {
    method: "GET",
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...customConfig,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { message: response.statusText } };
      }

      const errorMessage =
        errorData?.error?.message || errorData?.message || "An unexpected API error occurred";
      const errorCode = errorData?.error?.code || "HTTP_ERROR";
      const errorDetails = errorData?.error?.details;

      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    const data: ApiResponse<T> = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network failure or server unreachable",
      0,
      "NETWORK_ERROR"
    );
  }
}
