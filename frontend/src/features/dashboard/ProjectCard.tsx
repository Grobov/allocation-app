import type { DashboardAllocation, DashboardProject } from '../../api/types'
import { Menu } from '../../components/Menu'
import { AllocationCard } from './AllocationCard'

interface ProjectCardProps {
  project: DashboardProject
  onEdit: () => void
  onDelete: () => void
  onAllocate: () => void
  onEditAllocation: (allocation: DashboardAllocation) => void
}

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  onAllocate,
  onEditAllocation,
}: ProjectCardProps) {
  const headingId = `project-${project.id}-title`
  return (
    <article className="project" aria-labelledby={headingId}>
      <div className="project-head">
        <div>
          <h3 id={headingId}>{project.name}</h3>
          {project.description && <div className="project-desc">{project.description}</div>}
        </div>
        <Menu
          label={`Actions for project ${project.name}`}
          items={[
            { label: 'Edit project', onSelect: onEdit },
            { label: 'Delete project', onSelect: onDelete, danger: true },
          ]}
        />
      </div>
      {project.allocations.length > 0 ? (
        <ul className="allocs" aria-label={`Engineers allocated to ${project.name}`}>
          {project.allocations.map((allocation) => (
            <AllocationCard
              key={allocation.id}
              allocation={allocation}
              onEdit={() => onEditAllocation(allocation)}
            />
          ))}
        </ul>
      ) : (
        <div className="empty">No QA engineers allocated</div>
      )}
      <div className="add-row">
        <button type="button" className="add-link" onClick={onAllocate}>
          + Allocate engineer
        </button>
      </div>
    </article>
  )
}
