import type {
  Allocation,
  AllocationCreateInput,
  AllocationUpdateInput,
  Cluster,
  ClusterInput,
  Dashboard,
  Engineer,
  EngineerInput,
  EngineerOverview,
  Project,
  ProjectInput,
} from './types'

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Error raised for non-2xx responses, carrying the backend's structured error body. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your connection.')
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (data as ErrorBody | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'http_error',
      error?.message ?? `Request failed (${response.status}).`,
      error?.fields ?? {},
    )
  }
  return data as T
}

export const api = {
  dashboard: () => request<Dashboard>('GET', '/dashboard'),

  listClusters: () => request<Cluster[]>('GET', '/clusters'),
  createCluster: (input: ClusterInput) => request<Cluster>('POST', '/clusters', input),
  updateCluster: (id: number, input: Partial<ClusterInput>) =>
    request<Cluster>('PATCH', `/clusters/${id}`, input),
  deleteCluster: (id: number) => request<void>('DELETE', `/clusters/${id}`),

  createProject: (input: ProjectInput) => request<Project>('POST', '/projects', input),
  updateProject: (id: number, input: Partial<ProjectInput>) =>
    request<Project>('PATCH', `/projects/${id}`, input),
  deleteProject: (id: number) => request<void>('DELETE', `/projects/${id}`),

  listEngineers: () => request<Engineer[]>('GET', '/engineers'),
  engineersOverview: () => request<EngineerOverview[]>('GET', '/engineers/overview'),
  createEngineer: (input: EngineerInput) => request<Engineer>('POST', '/engineers', input),
  updateEngineer: (id: number, input: Partial<EngineerInput>) =>
    request<Engineer>('PATCH', `/engineers/${id}`, input),
  deleteEngineer: (id: number) => request<void>('DELETE', `/engineers/${id}`),

  createAllocation: (input: AllocationCreateInput) =>
    request<Allocation>('POST', '/allocations', input),
  updateAllocation: (id: number, input: AllocationUpdateInput) =>
    request<Allocation>('PATCH', `/allocations/${id}`, input),
  endAllocation: (id: number) => request<Allocation>('POST', `/allocations/${id}/end`),
}
