import { ApiError } from '../api/client'

const GENERIC_VALIDATION_MESSAGE = 'The request contains invalid data.'

/**
 * Splits an error into per-field messages (for fields the form displays) and a general
 * message for everything else.
 */
export function splitError(
  error: unknown,
  knownFields: readonly string[],
): { fields: Record<string, string>; message: string | null } {
  if (!error) return { fields: {}, message: null }
  if (!(error instanceof ApiError)) return { fields: {}, message: 'Something went wrong.' }

  const fields: Record<string, string> = {}
  const unmatched: string[] = []
  for (const [field, text] of Object.entries(error.fields)) {
    if (knownFields.includes(field)) fields[field] = text
    else unmatched.push(text)
  }

  if (unmatched.length > 0) {
    const message =
      error.message === GENERIC_VALIDATION_MESSAGE ? unmatched.join(' ') : error.message
    return { fields, message }
  }
  return { fields, message: Object.keys(fields).length > 0 ? null : error.message }
}

export function errorMessage(error: unknown): string | null {
  if (!error) return null
  return error instanceof ApiError ? error.message : 'Something went wrong.'
}
