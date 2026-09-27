import { useMemo, useState } from 'react'

import { api } from '../../api/client'
import { useApiMutation, useEngineersOverview } from '../../api/queries'
import type {
  AllocationRole,
  AllocationUpdateInput,
  DashboardAllocation,
  DashboardProject,
} from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Field, FormError } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { errorMessage, splitError } from '../../lib/errors'

interface AllocationDialogProps {
  project: DashboardProject
  /** Allocation being edited; omitted when allocating a new engineer. */
  allocation?: DashboardAllocation
  /** Today's date according to the server (YYYY-MM-DD). */
  today: string
  onClose: () => void
}

type Errors = Partial<Record<'engineer_id' | 'percent' | 'start_date' | 'end_date', string>>

const FIELDS = ['engineer_id', 'percent', 'start_date', 'end_date', 'role', 'comment'] as const

export function AllocationDialog({ project, allocation, today, onClose }: AllocationDialogProps) {
  const editing = allocation !== undefined
  const overview = useEngineersOverview()

  const [engineerId, setEngineerId] = useState(allocation ? String(allocation.engineer.id) : '')
  const [role, setRole] = useState<AllocationRole>(allocation?.role ?? 'QC')
  const [percent, setPercent] = useState(String(allocation?.percent ?? 100))
  const [startDate, setStartDate] = useState(allocation?.start_date ?? today)
  const [endDate, setEndDate] = useState(allocation?.end_date ?? '')
  const [comment, setComment] = useState(allocation?.comment ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [confirmingEnd, setConfirmingEnd] = useState(false)

  const save = useApiMutation((input: AllocationUpdateInput & { engineer_id: number }) => {
    const { engineer_id, ...fields } = input
    return editing
      ? api.updateAllocation(allocation.id, fields)
      : api.createAllocation({ ...fields, engineer_id, project_id: project.id })
  })
  const end = useApiMutation((id: number) => api.endAllocation(id))
  const busy = save.isPending || end.isPending
  const serverError = splitError(save.error, FIELDS)

  // Engineers already allocated to this project cannot be allocated to it twice.
  const engineerOptions = useMemo(() => {
    const onProject = new Set(project.allocations.map((a) => a.engineer.id))
    return (overview.data ?? []).filter((engineer) => editing || !onProject.has(engineer.id))
  }, [overview.data, project.allocations, editing])

  const validate = (): Errors => {
    const result: Errors = {}
    if (!engineerId) result.engineer_id = 'Select an engineer.'
    const value = Number(percent)
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      result.percent = 'Enter a whole number from 1 to 100.'
    }
    if (!startDate) result.start_date = 'Select a start date.'
    if (startDate && endDate && endDate < startDate) {
      result.end_date = 'End date cannot be before the start date.'
    }
    return result
  }

  const submit = () => {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate(
      {
        engineer_id: Number(engineerId),
        role,
        percent: Number(percent),
        comment: comment.trim(),
        start_date: startDate,
        end_date: endDate || null,
      },
      { onSuccess: onClose },
    )
  }

  const fieldError = (name: keyof Errors) => errors[name] ?? serverError.fields[name]

  return (
    <>
      <Modal
        title={editing ? 'Edit allocation' : 'Allocate engineer'}
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        actions={
          <>
            <button
              type="button"
              className="btn danger"
              disabled={!editing || busy}
              onClick={() => {
                end.reset()
                setConfirmingEnd(true)
              }}
            >
              End allocation
            </button>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {editing ? 'Save changes' : 'Allocate engineer'}
            </button>
          </>
        }
      >
        <FormError message={serverError.message} />
        <Field id="allocation-engineer" label="Engineer" error={fieldError('engineer_id')}>
          <select
            value={engineerId}
            onChange={(e) => setEngineerId(e.target.value)}
            disabled={editing}
            required
            autoFocus={!editing}
          >
            {editing ? (
              <option value={allocation.engineer.id}>{allocation.engineer.full_name}</option>
            ) : (
              <>
                <option value="" disabled>
                  {overview.isLoading ? 'Loading engineers…' : 'Select an engineer'}
                </option>
                {engineerOptions.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.full_name} ({engineer.total_percent}% allocated)
                  </option>
                ))}
              </>
            )}
          </select>
        </Field>
        <Field id="allocation-project" label="Project">
          <input type="text" value={project.name} readOnly />
        </Field>
        <Field id="allocation-role" label="Role" error={serverError.fields.role}>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AllocationRole)}
            autoFocus={editing}
          >
            <option value="QC">QC</option>
            <option value="QC Lead">QC Lead</option>
          </select>
        </Field>
        <Field id="allocation-percent" label="Allocation %" error={fieldError('percent')}>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            inputMode="numeric"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            required
          />
        </Field>
        <Field id="allocation-start" label="Start date" error={fieldError('start_date')}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field
          id="allocation-end"
          label="End date (optional)"
          error={fieldError('end_date')}
          note="Leave empty for an open-ended allocation."
        >
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <Field
          id="allocation-comment"
          label="Project-specific comment"
          full
          error={serverError.fields.comment}
        >
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </Field>
      </Modal>
      {editing && confirmingEnd && (
        <ConfirmDialog
          title="End allocation"
          message={
            <>
              End the allocation of <b>{allocation.engineer.full_name}</b> on <b>{project.name}</b>?{' '}
              {allocation.status === 'planned'
                ? 'The planned allocation will be cancelled.'
                : 'It will end today.'}{' '}
              The allocation is kept in the history.
            </>
          }
          confirmLabel="End allocation"
          busy={end.isPending}
          error={errorMessage(end.error)}
          onClose={() => setConfirmingEnd(false)}
          onConfirm={() => end.mutate(allocation.id, { onSuccess: onClose })}
        />
      )}
    </>
  )
}
