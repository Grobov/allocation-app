import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import { splitError } from './errors'

describe('splitError', () => {
  it('returns nothing without an error', () => {
    expect(splitError(null, ['name'])).toEqual({ fields: {}, message: null })
  })

  it('maps known fields and hides the generic message', () => {
    const error = new ApiError(409, 'conflict', 'Cluster exists.', { name: 'Cluster exists.' })
    expect(splitError(error, ['name'])).toEqual({
      fields: { name: 'Cluster exists.' },
      message: null,
    })
  })

  it('shows unknown field messages instead of the generic validation text', () => {
    const error = new ApiError(422, 'validation_error', 'The request contains invalid data.', {
      request: 'End date cannot be before the start date.',
    })
    expect(splitError(error, ['end_date']).message).toBe(
      'End date cannot be before the start date.',
    )
  })

  it('uses the error message when there are no fields', () => {
    const error = new ApiError(409, 'conflict', 'Already ended.')
    expect(splitError(error, ['name']).message).toBe('Already ended.')
  })

  it('handles unexpected errors', () => {
    expect(splitError(new Error('boom'), []).message).toBe('Something went wrong.')
  })
})
