import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  /** Form content (rendered inside the `.form` grid). */
  children: ReactNode
  /** Buttons rendered in the footer; a submit button submits the form. */
  actions: ReactNode
  onSubmit?: () => void
  /** Prevents closing while a request is in flight. */
  busy?: boolean
}

/**
 * Modal dialog built on the native <dialog> element (focus trapping, Escape handling,
 * top-layer stacking and inert background come from the browser). It opens on mount,
 * so callers render it conditionally.
 */
export function Modal({ title, onClose, children, actions, onSubmit, busy = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!busy) onSubmit?.()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape key: let React state drive closing.
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>
        <div className="form">{children}</div>
        <div className="modal-actions">{actions}</div>
      </form>
    </dialog>
  )
}
