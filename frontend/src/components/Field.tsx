import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  note?: ReactNode
  error?: string
  full?: boolean
  children: ReactElement<Record<string, unknown>>
}

/** Label + control + optional note and error, wired up with ARIA attributes. */
export function Field({ id, label, note, error, full = false, children }: FieldProps) {
  const noteId = note ? `${id}-note` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, noteId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children

  return (
    <div className={full ? 'field full' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {control}
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
      {note && (
        <span id={noteId} className="note">
          {note}
        </span>
      )}
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="form-error field full" role="alert">
      {message}
    </div>
  )
}
