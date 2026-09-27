import { useState } from 'react'

import { api } from '../../api/client'
import { useApiMutation, useEngineers } from '../../api/queries'
import type { Cluster, ClusterInput, DashboardCluster } from '../../api/types'
import { Field, FormError } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { splitError } from '../../lib/errors'

interface ClusterDialogProps {
  /** Cluster being edited; omitted when creating. */
  cluster?: DashboardCluster
  onClose: () => void
  onSaved: (cluster: Cluster) => void
}

export function ClusterDialog({ cluster, onClose, onSaved }: ClusterDialogProps) {
  const editing = cluster !== undefined
  const engineers = useEngineers()
  const [name, setName] = useState(cluster?.name ?? '')
  const [managerId, setManagerId] = useState(
    cluster?.qa_manager ? String(cluster.qa_manager.id) : '',
  )
  const [nameError, setNameError] = useState<string>()

  const mutation = useApiMutation((input: ClusterInput) =>
    editing ? api.updateCluster(cluster.id, input) : api.createCluster(input),
  )
  const serverError = splitError(mutation.error, ['name', 'qa_manager_id'])

  const submit = () => {
    if (!name.trim()) {
      setNameError('Enter a cluster name.')
      return
    }
    setNameError(undefined)
    mutation.mutate(
      { name: name.trim(), qa_manager_id: managerId ? Number(managerId) : null },
      { onSuccess: onSaved },
    )
  }

  return (
    <Modal
      title={editing ? 'Edit cluster' : 'Create cluster'}
      onClose={onClose}
      onSubmit={submit}
      busy={mutation.isPending}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={mutation.isPending}>
            {editing ? 'Save changes' : 'Create cluster'}
          </button>
        </>
      }
    >
      <FormError message={serverError.message} />
      <Field
        id="cluster-name"
        label="Cluster name"
        full
        error={nameError ?? serverError.fields.name}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Customer Experience"
          maxLength={120}
          required
          autoFocus
        />
      </Field>
      <Field
        id="cluster-manager"
        label="QA Manager"
        full
        note="QA Manager references an existing Engineer."
        error={serverError.fields.qa_manager_id}
      >
        <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          <option value="">Not assigned</option>
          {engineers.data?.map((engineer) => (
            <option key={engineer.id} value={engineer.id}>
              {engineer.full_name}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  )
}
