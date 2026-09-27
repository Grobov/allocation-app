import { ApiError } from '../api/client'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      {label}
    </div>
  )
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.'
  return (
    <div className="state-box error" role="alert">
      <p>Could not load data. {message}</p>
      <button type="button" className="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
