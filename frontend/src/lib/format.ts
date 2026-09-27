const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Formats an ISO date (YYYY-MM-DD) as "01 Sep 2026" without timezone shifts. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`
}

interface Period {
  status: 'planned' | 'active' | 'ended'
  start_date: string
  end_date: string | null
}

/** Human-readable period of an allocation, as shown on allocation cards. */
export function describePeriod({ status, start_date, end_date }: Period): string {
  if (status === 'planned') {
    return end_date
      ? `${formatDate(start_date)} — ${formatDate(end_date)}`
      : `Starts ${formatDate(start_date)}`
  }
  if (status === 'active') {
    const since = `Active since ${formatDate(start_date)}`
    return end_date ? `${since} · until ${formatDate(end_date)}` : since
  }
  return end_date ? `Ended ${formatDate(end_date)}` : 'Ended'
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm
}
