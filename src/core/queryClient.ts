import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes before data is considered stale
      gcTime: 30 * 60 * 1000,        // 30 minutes before unused data is garbage collected
      retry: 1,                       // Retry failed queries once
      refetchOnWindowFocus: false,    // Don't refetch when window regains focus
    },
  },
});
