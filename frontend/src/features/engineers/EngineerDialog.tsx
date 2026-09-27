import { useState } from 'react'

import { api } from '../../api/client'
import { useApiMutation } from '../../api/queries'
import type { EngineerInput } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Field, FormError } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { errorMessage, splitError } from '../../lib/errors'
import { plural } from '../../lib/format'

interface EngineerDialogProps {
  /** Engineer being edited; omitted when creating. */
  engineer?: {
    id: number
    full_name: string
    comment: string
    managedClusters: string[]
    currentAllocations: number
  }
  onClose: () => void
}

export function EngineerDialog({ engineer, onClose }: EngineerDialogProps) {
  const editing = engineer !== undefined
  const [fullName, setFullName] = useState(engineer?.full_name ?? '')
  const [comment, setComment] = useState(engineer?.comment ?? '')
  const [nameError, setNameError] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const save = useApiMutation((input: EngineerInput) =>
    editing ? api.updateEngineer(engineer.id, input) : api.createEngineer(input),
  )
  const remove = useApiMutation((id: number) => api.deleteEngineer(id))
  const serverError = splitError(save.error, ['full_name', 'comment'])
  const busy = save.isPending || remove.isPending

  const submit = () => {
    if (!fullName.trim()) {
      setNameError('Enter the engineer’s full name.')
      return
    }
    setNameError(undefined)
    save.mutate({ full_name: fullName.trim(), comment: comment.trim() }, { onSuccess: onClose })
  }

  return (
    <>
      <Modal
        title={editing ? 'Edit engineer' : 'Create engineer'}
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        actions={
          <>
            {editing && (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  remove.reset()
                  setConfirmingDelete(true)
                }}
                disabled={busy}
              >
                Delete engineer
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {editing ? 'Save changes' : 'Create engineer'}
            </button>
          </>
        }
      >
        <FormError message={serverError.message} />
        <Field
          id="engineer-name"
          label="Full name"
          full
          error={nameError ?? serverError.fields.full_name}
        >
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Oleksii Marchenko"
            maxLength={120}
            required
            autoFocus
          />
        </Field>
        <Field
          id="engineer-comment"
          label="General comment"
          full
          note="This comment belongs to the person, not to a specific project allocation."
          error={serverError.fields.comment}
        >
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </Field>
      </Modal>
      {editing && confirmingDelete && (
        <ConfirmDialog
          title="Delete engineer"
          blocked={engineer.currentAllocations > 0}
          message={
            engineer.currentAllocations > 0 ? (
              <>
                <b>{engineer.full_name}</b> has {engineer.currentAllocations} current{' '}
                {plural(engineer.currentAllocations, 'allocation')}. End them before deleting the
                engineer.
              </>
            ) : (
              <>
                Delete <b>{engineer.full_name}</b>? Their allocation history is kept.
                {engineer.managedClusters.length > 0 &&
                  ` ${engineer.managedClusters.join(', ')} will have no QA Manager.`}
              </>
            )
          }
          confirmLabel="Delete engineer"
          busy={remove.isPending}
          error={errorMessage(remove.error)}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() => remove.mutate(engineer.id, { onSuccess: onClose })}
        />
      )}
    </>
  )
}
