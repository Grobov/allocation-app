import type { ReactNode } from 'react'

import { FormError } from './Field'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
  error?: string | null
  /** The action is not possible; the message explains why and only "Close" is offered. */
  blocked?: boolean
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  error,
  blocked = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      onSubmit={blocked ? onClose : onConfirm}
      busy={busy}
      actions={
        blocked ? (
          <button type="submit" className="btn" autoFocus>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn primary danger-fill" disabled={busy} autoFocus>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </>
        )
      }
    >
      <p className="confirm-text field full">{message}</p>
      <FormError message={error} />
    </Modal>
  )
}
