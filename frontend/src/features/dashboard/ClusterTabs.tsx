import { useRef, type KeyboardEvent } from 'react'

import type { DashboardCluster } from '../../api/types'
import { panelId, tabId } from './ids'

interface ClusterTabsProps {
  clusters: DashboardCluster[]
  selectedId: number
  onSelect: (clusterId: number) => void
}

/** Cluster tab strip following the WAI-ARIA tabs pattern (automatic activation). */
export function ClusterTabs({ clusters, selectedId, onSelect }: ClusterTabsProps) {
  const refs = useRef(new Map<number, HTMLButtonElement>())

  const onKeyDown = (event: KeyboardEvent) => {
    const index = clusters.findIndex((c) => c.id === selectedId)
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: clusters.length - 1,
    }
    if (!(event.key in targets)) return
    event.preventDefault()
    const next = clusters[(targets[event.key]! + clusters.length) % clusters.length]
    if (next) {
      onSelect(next.id)
      refs.current.get(next.id)?.focus()
    }
  }

  return (
    <div className="cluster-tabs" role="tablist" aria-label="Clusters">
      {clusters.map((cluster) => {
        const selected = cluster.id === selectedId
        return (
          <button
            key={cluster.id}
            ref={(node) => {
              if (node) refs.current.set(cluster.id, node)
              else refs.current.delete(cluster.id)
            }}
            type="button"
            role="tab"
            id={tabId(cluster.id)}
            aria-selected={selected}
            aria-controls={panelId(cluster.id)}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'cluster-tab active' : 'cluster-tab'}
            onClick={() => onSelect(cluster.id)}
            onKeyDown={onKeyDown}
          >
            {cluster.name}
          </button>
        )
      })}
    </div>
  )
}
