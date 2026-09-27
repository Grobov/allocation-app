import { useState } from 'react'

import { api } from '../../api/client'
import { useApiMutation } from '../../api/queries'
import type { ClusterRef, DashboardProject, Project, ProjectInput } from '../../api/types'
import { Field, FormError } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { splitError } from '../../lib/errors'

interface ProjectDialogProps {
  /** Project being edited; omitted when creating. */
  project?: DashboardProject
  /** Cluster the project is created in / currently belongs to. */
  clusterId: number
  clusters: ClusterRef[]
  onClose: () => void
  onSaved: (project: Project) => void
}

export function ProjectDialog({
  project,
  clusterId,
  clusters,
  onClose,
  onSaved,
}: ProjectDialogProps) {
  const editing = project !== undefined
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [selectedCluster, setSelectedCluster] = useState(String(clusterId))
  const [nameError, setNameError] = useState<string>()

  const mutation = useApiMutation((input: ProjectInput) =>
    editing ? api.updateProject(project.id, input) : api.createProject(input),
  )
  const serverError = splitError(mutation.error, ['name', 'cluster_id', 'description'])

  const submit = () => {
    if (!name.trim()) {
      setNameError('Enter a project name.')
      return
    }
    setNameError(undefined)
    mutation.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        // When creating, the project always goes to the currently selected cluster.
        cluster_id: editing ? Number(selectedCluster) : clusterId,
      },
      { onSuccess: onSaved },
    )
  }

  return (
    <Modal
      title={editing ? 'Edit project' : 'Create project'}
      onClose={onClose}
      onSubmit={submit}
      busy={mutation.isPending}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={mutation.isPending}>
            {editing ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <FormError message={serverError.message} />
      <Field id="project-name" label="Project name" error={nameError ?? serverError.fields.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          autoFocus
        />
      </Field>
      <Field
        id="project-cluster"
        label="Cluster"
        error={serverError.fields.cluster_id}
        note={
          editing
            ? 'Changing the cluster will move this project to the selected cluster.'
            : 'The project will be created in the currently selected cluster.'
        }
      >
        <select
          value={selectedCluster}
          onChange={(e) => setSelectedCluster(e.target.value)}
          disabled={!editing}
        >
          {clusters.map((cluster) => (
            <option key={cluster.id} value={cluster.id}>
              {cluster.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="project-description"
        label="Description"
        full
        error={serverError.fields.description}
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </Field>
    </Modal>
  )
}
