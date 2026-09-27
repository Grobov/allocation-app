import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '../../api/client'
import { useApiMutation, useDashboard } from '../../api/queries'
import type { DashboardAllocation, DashboardCluster, DashboardProject } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { plural } from '../../lib/format'
import { AllocationDialog } from '../allocations/AllocationDialog'
import { ClusterDialog } from '../clusters/ClusterDialog'
import { ProjectDialog } from '../projects/ProjectDialog'
import { ClusterPanel } from './ClusterPanel'
import { ClusterTabs } from './ClusterTabs'
import { SummaryMetrics } from './SummaryMetrics'

type DialogState =
  | { kind: 'cluster'; cluster?: DashboardCluster }
  | { kind: 'delete-cluster'; cluster: DashboardCluster }
  | { kind: 'project'; clusterId: number; project?: DashboardProject }
  | { kind: 'delete-project'; project: DashboardProject }
  | { kind: 'allocation'; project: DashboardProject; allocation?: DashboardAllocation }

export function DashboardPage() {
  const dashboard = useDashboard()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const close = () => setDialog(null)

  const selectCluster = (clusterId: number) =>
    setSearchParams({ cluster: String(clusterId) }, { replace: true })

  const header = (
    <div className="top">
      <div>
        <h1>Allocation Dashboard</h1>
        <p>Clusters, projects and current QA allocations.</p>
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => setDialog({ kind: 'cluster' })}
        >
          + Cluster
        </button>
      </div>
    </div>
  )

  if (dashboard.isPending) {
    return (
      <>
        {header}
        <Loading label="Loading dashboard…" />
      </>
    )
  }
  if (dashboard.isError) {
    return (
      <>
        {header}
        <LoadError error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </>
    )
  }

  const { clusters, summary, today } = dashboard.data
  const requestedId = Number(searchParams.get('cluster'))
  const selected = clusters.find((c) => c.id === requestedId) ?? clusters[0]
  const clusterRefs = clusters.map(({ id, name }) => ({ id, name }))

  return (
    <>
      {header}
      <SummaryMetrics summary={summary} />

      {selected ? (
        <>
          <ClusterTabs clusters={clusters} selectedId={selected.id} onSelect={selectCluster} />
          <ClusterPanel
            cluster={selected}
            onEditCluster={() => setDialog({ kind: 'cluster', cluster: selected })}
            onDeleteCluster={() => setDialog({ kind: 'delete-cluster', cluster: selected })}
            onCreateProject={() => setDialog({ kind: 'project', clusterId: selected.id })}
            onEditProject={(project) =>
              setDialog({ kind: 'project', clusterId: project.cluster_id, project })
            }
            onDeleteProject={(project) => setDialog({ kind: 'delete-project', project })}
            onAllocate={(project) => setDialog({ kind: 'allocation', project })}
            onEditAllocation={(project, allocation) =>
              setDialog({ kind: 'allocation', project, allocation })
            }
          />
        </>
      ) : (
        <div className="empty-cluster standalone">
          No clusters yet. Create a cluster to start organising projects and allocations.
          <br />
          <br />
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'cluster' })}>
            Create first cluster
          </button>
        </div>
      )}

      {dialog?.kind === 'cluster' && (
        <ClusterDialog
          cluster={dialog.cluster}
          onClose={close}
          onSaved={(cluster) => {
            close()
            selectCluster(cluster.id)
          }}
        />
      )}
      {dialog?.kind === 'delete-cluster' && (
        <DeleteClusterDialog cluster={dialog.cluster} onClose={close} />
      )}
      {dialog?.kind === 'project' && (
        <ProjectDialog
          project={dialog.project}
          clusterId={dialog.clusterId}
          clusters={clusterRefs}
          onClose={close}
          onSaved={(project) => {
            close()
            // Follow a project that was moved to another cluster.
            selectCluster(project.cluster_id)
          }}
        />
      )}
      {dialog?.kind === 'delete-project' && (
        <DeleteProjectDialog project={dialog.project} onClose={close} />
      )}
      {dialog?.kind === 'allocation' && (
        <AllocationDialog
          project={dialog.project}
          allocation={dialog.allocation}
          today={today}
          onClose={close}
        />
      )}
    </>
  )
}

function DeleteClusterDialog({
  cluster,
  onClose,
}: {
  cluster: DashboardCluster
  onClose: () => void
}) {
  const remove = useApiMutation((id: number) => api.deleteCluster(id))
  const count = cluster.projects.length
  return (
    <ConfirmDialog
      title="Delete cluster"
      blocked={count > 0}
      message={
        count > 0 ? (
          <>
            <b>{cluster.name}</b> still has {count} {plural(count, 'project')}. Move or delete{' '}
            {plural(count, 'it', 'them')} before deleting the cluster.
          </>
        ) : (
          <>
            Delete the cluster <b>{cluster.name}</b>?
          </>
        )
      }
      confirmLabel="Delete cluster"
      busy={remove.isPending}
      error={errorMessage(remove.error)}
      onClose={onClose}
      onConfirm={() => remove.mutate(cluster.id, { onSuccess: onClose })}
    />
  )
}

function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: DashboardProject
  onClose: () => void
}) {
  const remove = useApiMutation((id: number) => api.deleteProject(id))
  const count = project.allocations.length
  return (
    <ConfirmDialog
      title="Delete project"
      blocked={count > 0}
      message={
        count > 0 ? (
          <>
            <b>{project.name}</b> has {count} current {plural(count, 'allocation')}. End{' '}
            {plural(count, 'it', 'them')} before deleting the project.
          </>
        ) : (
          <>
            Delete the project <b>{project.name}</b>? Its allocation history is kept.
          </>
        )
      }
      confirmLabel="Delete project"
      busy={remove.isPending}
      error={errorMessage(remove.error)}
      onClose={onClose}
      onConfirm={() => remove.mutate(project.id, { onSuccess: onClose })}
    />
  )
}
