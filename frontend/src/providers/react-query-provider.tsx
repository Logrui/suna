'use client';

import { useState } from 'react';
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { handleApiError } from '@/lib/error-handler';
import { isLocalMode } from '@/lib/config';
import { BillingError, AgentRunLimitError } from '@/lib/api';
import { useMaintenanceStore } from '@/stores/maintenance-store';

export function ReactQueryProvider({
  children,
  dehydratedState,
}: {
  children: React.ReactNode;
  dehydratedState?: unknown;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error: any) => {
            if (error?.status === 404) {
              useMaintenanceStore.getState().setMaintenanceMode(true);
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error: any, variables: any, context: any) => {
            if (error?.status === 404) {
              useMaintenanceStore.getState().setMaintenanceMode(true);
            }
            // Don't globally handle errors that are expected to be handled by components
            if (error instanceof BillingError || error instanceof AgentRunLimitError) {
              return; // Let components handle these specific errors
            }
            handleApiError(error, {
              operation: 'perform action',
              silent: false,
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 20 * 1000,
            gcTime: 2 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if (error?.status >= 400 && error?.status < 500) return false;
              if (error?.status === 404) return false;
              return failureCount < 3;
            },
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
          },
          mutations: {
            retry: (failureCount, error: any) => {
              if (error?.status >= 400 && error?.status < 500) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );

  const isLocal = isLocalMode();

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState as any}>
        {children}
        {isLocal && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
