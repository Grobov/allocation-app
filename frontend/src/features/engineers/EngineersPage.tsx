import { useState } from 'react'

import { useEngineersOverview } from '../../api/queries'
import type { EngineerOverview, EngineerStatus } from '../../api/types'
import { LoadError, Loading } from '../../components/QueryState'
import { EngineerDialog } from './EngineerDialog'

const STATUS: Record<EngineerStatus, { label: string; className: string }> = {
  allocated: { label: 'Allocated', className: 'status' },
  planned: { label: 'Planned', className: 'status' },
  unallocated: { label: 'Unallocated', className: 'status unallocated' },
  manager: { label: 'Manager', className: 'status manager' },
}

type DialogState = { engineer?: EngineerOverview } | null

export function EngineersPage() {
  const overview = useEngineersOverview()
  const [dialog, setDialog] = useState<DialogState>(null)

  return (
    <>
      <div className="top">
        <div>
          <h1>Engineers</h1>
          <p>People are managed independently from project allocations.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setDialog({})}>
          + Engineer
        </button>
      </div>

      {overview.isPending ? (
        <Loading label="Loading engineers…" />
      ) : overview.isError ? (
        <LoadError error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Engineers and their current allocations</caption>
            <thead>
              <tr>
                <th scope="col">Engineer</th>
                <th scope="col">General comment</th>
                <th scope="col">Current allocations</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No engineers yet. Add the first engineer with “+ Engineer”.
                  </td>
                </tr>
              )}
              {overview.data.map((engineer) => (
                <EngineerRow
                  key={engineer.id}
                  engineer={engineer}
                  onEdit={() => setDialog({ engineer })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <EngineerDialog
          engineer={
            dialog.engineer && {
              id: dialog.engineer.id,
              full_name: dialog.engineer.full_name,
              comment: dialog.engineer.comment,
              managedClusters: dialog.engineer.managed_clusters.map((c) => c.name),
              currentAllocations: dialog.engineer.allocations.length,
            }
          }
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

function EngineerRow({ engineer, onEdit }: { engineer: EngineerOverview; onEdit: () => void }) {
  const lines = [
    ...engineer.allocations.map(
      (a) =>
        `${a.project.name} · ${a.role} · ${a.percent}%${a.status === 'planned' ? ' (planned)' : ''}`,
    ),
    ...engineer.managed_clusters.map((c) => `Cluster manager: ${c.name}`),
  ]
  const hasAllocations = engineer.allocations.length > 0
  const status = STATUS[engineer.status]

  return (
    <tr>
      <th scope="row" className="row-head">
        {engineer.full_name}
      </th>
      <td>{engineer.comment || '—'}</td>
      <td>
        {lines.length === 0
          ? '—'
          : lines.map((line, index) => (
              <span key={index} className="line">
                {line}
              </span>
            ))}
      </td>
      <td>
        {!hasAllocations && engineer.status === 'manager' ? '—' : `${engineer.total_percent}%`}
      </td>
      <td className={status.className}>{status.label}</td>
      <td>
        <button
          type="button"
          className="btn"
          aria-label={`Edit ${engineer.full_name}`}
          onClick={onEdit}
        >
          Edit
        </button>
      </td>
    </tr>
  )
}
