import type { DashboardAllocation, DashboardCluster, DashboardProject } from '../../api/types'
import { Menu } from '../../components/Menu'
import { panelId, tabId } from './ids'
import { ProjectCard } from './ProjectCard'

export interface ClusterPanelActions {
  onEditCluster: () => void
  onDeleteCluster: () => void
  onCreateProject: () => void
  onEditProject: (project: DashboardProject) => void
  onDeleteProject: (project: DashboardProject) => void
  onAllocate: (project: DashboardProject) => void
  onEditAllocation: (project: DashboardProject, allocation: DashboardAllocation) => void
}

interface ClusterPanelProps extends ClusterPanelActions {
  cluster: DashboardCluster
}

export function ClusterPanel({ cluster, ...actions }: ClusterPanelProps) {
  return (
    <section
      className="cluster"
      role="tabpanel"
      id={panelId(cluster.id)}
      aria-labelledby={tabId(cluster.id)}
    >
      <div className="cluster-head">
        <div className="cluster-title">
          <div>
            <h2>{cluster.name}</h2>
            <div className="manager">
              QA Manager: {cluster.qa_manager?.full_name ?? 'Not assigned'}
            </div>
          </div>
        </div>
        <div className="cluster-actions">
          <button type="button" className="btn" onClick={actions.onCreateProject}>
            + Project
          </button>
          <Menu
            label={`Actions for cluster ${cluster.name}`}
            items={[
              { label: 'Edit cluster', onSelect: actions.onEditCluster },
              { label: 'Delete cluster', onSelect: actions.onDeleteCluster, danger: true },
            ]}
          />
        </div>
      </div>
      {cluster.projects.length > 0 ? (
        <div className="projects">
          {cluster.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => actions.onEditProject(project)}
              onDelete={() => actions.onDeleteProject(project)}
              onAllocate={() => actions.onAllocate(project)}
              onEditAllocation={(allocation) => actions.onEditAllocation(project, allocation)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-cluster">
          No projects in this cluster.
          <br />
          <br />
          <button type="button" className="btn" onClick={actions.onCreateProject}>
            Create first project
          </button>
        </div>
      )}
    </section>
  )
}
