import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  engineers: ['engineers'] as const,
  engineersOverview: ['engineers', 'overview'] as const,
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard })
}

export function useEngineers() {
  return useQuery({ queryKey: queryKeys.engineers, queryFn: api.listEngineers })
}

export function useEngineersOverview() {
  return useQuery({ queryKey: queryKeys.engineersOverview, queryFn: api.engineersOverview })
}

/**
 * Wraps a mutation so that all cached views are refreshed afterwards: any change
 * (e.g. an allocation) affects both the dashboard and the engineers overview.
 */
export function useApiMutation<TVariables, TResult>(
  fn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
