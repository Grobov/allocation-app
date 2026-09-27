import type { DashboardAllocation } from '../../api/types'
import { describePeriod } from '../../lib/format'

interface AllocationCardProps {
  allocation: DashboardAllocation
  onEdit: () => void
}

export function AllocationCard({ allocation, onEdit }: AllocationCardProps) {
  const { engineer, role, percent, comment, status } = allocation
  return (
    <li className="allocation">
      <div className="alloc-top">
        <div className="person">{engineer.full_name}</div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Edit allocation of ${engineer.full_name}`}
          title="Edit allocation"
          onClick={onEdit}
        >
          ✎
        </button>
      </div>
      <div className="tags">
        <span className={role === 'QC Lead' ? 'tag lead' : 'tag'}>{role}</span>
        {status === 'planned' ? (
          <span className="tag planned">Planned · {percent}%</span>
        ) : (
          <span className="tag percent">{percent}%</span>
        )}
      </div>
      {comment && <div className="comment">{comment}</div>}
      <div className="dates">{describePeriod(allocation)}</div>
    </li>
  )
}
