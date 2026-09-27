// Types mirroring the backend's response/request models (see /api/docs).

export type AllocationRole = 'QC' | 'QC Lead'
export type AllocationStatus = 'planned' | 'active' | 'ended'
export type EngineerStatus = 'allocated' | 'planned' | 'unallocated' | 'manager'

export interface EngineerRef {
  id: number
  full_name: string
}

export interface ClusterRef {
  id: number
  name: string
}

export interface ProjectRef {
  id: number
  name: string
  cluster_id: number
}

export interface Engineer {
  id: number
  full_name: string
  comment: string
  created_at: string
  updated_at: string
}

export interface Cluster {
  id: number
  name: string
  qa_manager_id: number | null
  qa_manager: EngineerRef | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: number
  name: string
  description: string
  cluster_id: number
  cluster: ClusterRef
  created_at: string
  updated_at: string
}

export interface Allocation {
  id: number
  engineer_id: number
  project_id: number
  engineer: EngineerRef
  project: ProjectRef
  role: AllocationRole
  percent: number
  comment: string
  start_date: string
  end_date: string | null
  ended_at: string | null
  status: AllocationStatus
  created_at: string
  updated_at: string
}

export interface DashboardAllocation {
  id: number
  engineer: EngineerRef
  role: AllocationRole
  percent: number
  comment: string
  start_date: string
  end_date: string | null
  status: AllocationStatus
}

export interface DashboardProject {
  id: number
  name: string
  description: string
  cluster_id: number
  allocations: DashboardAllocation[]
}

export interface DashboardCluster {
  id: number
  name: string
  qa_manager: EngineerRef | null
  projects: DashboardProject[]
}

export interface Dashboard {
  today: string
  summary: {
    clusters: number
    projects: number
    engineers: number
    unallocated_engineers: number
  }
  clusters: DashboardCluster[]
}

export interface EngineerOverview {
  id: number
  full_name: string
  comment: string
  allocations: {
    id: number
    project: ProjectRef
    role: AllocationRole
    percent: number
    start_date: string
    end_date: string | null
    status: AllocationStatus
  }[]
  managed_clusters: ClusterRef[]
  total_percent: number
  status: EngineerStatus
}

export interface ClusterInput {
  name: string
  qa_manager_id: number | null
}

export interface ProjectInput {
  name: string
  description: string
  cluster_id: number
}

export interface EngineerInput {
  full_name: string
  comment: string
}

export interface AllocationCreateInput {
  engineer_id: number
  project_id: number
  role: AllocationRole
  percent: number
  comment: string
  start_date: string
  end_date: string | null
}

export type AllocationUpdateInput = Omit<AllocationCreateInput, 'engineer_id' | 'project_id'>
