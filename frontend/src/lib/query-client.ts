import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute data staleness
        gcTime: 5 * 60 * 1000, // 5 minutes cache retention
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          // Do not retry 404s or 401s
          if (error?.status === 404 || error?.status === 401) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
