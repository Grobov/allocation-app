import type { Dashboard } from '../../api/types'
import { plural } from '../../lib/format'

export function SummaryMetrics({ summary }: { summary: Dashboard['summary'] }) {
  const metrics = [
    { value: summary.clusters, label: plural(summary.clusters, 'Cluster') },
    { value: summary.projects, label: plural(summary.projects, 'Project') },
    { value: summary.engineers, label: plural(summary.engineers, 'Engineer') },
    {
      value: summary.unallocated_engineers,
      label: plural(summary.unallocated_engineers, 'Unallocated engineer'),
    },
  ]
  return (
    <dl className="summary" aria-label="Summary">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}
