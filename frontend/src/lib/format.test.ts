import { describe, expect, it } from 'vitest'

import { describePeriod, formatDate, plural } from './format'

describe('formatDate', () => {
  it('formats ISO dates like the prototype', () => {
    expect(formatDate('2026-09-01')).toBe('01 Sep 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })

  it('returns unparseable input unchanged', () => {
    expect(formatDate('soon')).toBe('soon')
  })
})

describe('describePeriod', () => {
  it('describes active allocations', () => {
    expect(describePeriod({ status: 'active', start_date: '2026-09-01', end_date: null })).toBe(
      'Active since 01 Sep 2026',
    )
    expect(
      describePeriod({ status: 'active', start_date: '2026-09-01', end_date: '2026-12-31' }),
    ).toBe('Active since 01 Sep 2026 · until 31 Dec 2026')
  })

  it('describes planned allocations', () => {
    expect(
      describePeriod({ status: 'planned', start_date: '2026-10-01', end_date: '2026-12-31' }),
    ).toBe('01 Oct 2026 — 31 Dec 2026')
    expect(describePeriod({ status: 'planned', start_date: '2026-10-01', end_date: null })).toBe(
      'Starts 01 Oct 2026',
    )
  })
})

describe('plural', () => {
  it('picks the right form', () => {
    expect(plural(1, 'Cluster')).toBe('Cluster')
    expect(plural(0, 'Cluster')).toBe('Clusters')
    expect(plural(2, 'it', 'them')).toBe('them')
  })
})
