import { backendApi } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { dashboardKeys } from "./keys";
import { isLocalMode } from "@/lib/config";

export const useLimits = () => {
  return useQuery({
    queryKey: dashboardKeys.limits(),
    queryFn: async () => {
      const response = await backendApi.get('/limits');
      return response.data;
    },
    // Disable in local mode - endpoint doesn't exist
    enabled: !isLocalMode(),
    retry: false,
  });
};