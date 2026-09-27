import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { dashboard, engineersOverview } from '../../test/fixtures'
import { mockApi, renderWithProviders, requestBody } from '../../test/utils'
import { DashboardPage } from './DashboardPage'

function setup(routes: Record<string, object> = {}) {
  const fetchMock = mockApi({
    'GET /dashboard': dashboard,
    'GET /engineers': engineersOverview,
    'GET /engineers/overview': engineersOverview,
    ...routes,
  })
  const user = userEvent.setup()
  renderWithProviders(<DashboardPage />)
  return { fetchMock, user }
}

describe('DashboardPage', () => {
  it('shows summary metrics and the first cluster', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument()

    const summary = screen.getByLabelText('Summary')
    const metric = (label: string) => within(summary).getByText(label).parentElement
    expect(metric('Clusters')).toHaveTextContent('3')
    expect(metric('Engineers')).toHaveTextContent('4')
    expect(metric('Unallocated engineer')).toHaveTextContent('1')

    expect(screen.getByText('QA Manager: Olena Kovalenko')).toBeInTheDocument()
    const project = screen.getByRole('article', { name: 'Payment Gateway' })
    expect(within(project).getByText('Anna Melnyk')).toBeInTheDocument()
    expect(within(project).getByText('QC Lead')).toHaveClass('tag', 'lead')
    expect(within(project).getByText('Active since 01 Sep 2026')).toBeInTheDocument()
  })

  it('switches cluster tabs and shows empty states', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'Payments' })

    await user.click(screen.getByRole('tab', { name: 'Core Platform' }))
    expect(screen.getByRole('tab', { name: 'Core Platform' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('QA Manager: Not assigned')).toBeInTheDocument()
    expect(screen.getByText('No QA engineers allocated')).toBeInTheDocument()
    expect(screen.getByText('Planned · 50%')).toHaveClass('tag', 'planned')
    expect(screen.getByText('01 Oct 2026 — 31 Dec 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'New Initiatives' }))
    expect(screen.getByText('No projects in this cluster.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create first project' })).toBeInTheDocument()
  })

  it('supports keyboard navigation between tabs', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'Payments' })
    screen.getByRole('tab', { name: 'Payments' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Core Platform' })).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Core Platform' })).toBeInTheDocument()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'New Initiatives' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('creates a project in the selected cluster with the cluster field disabled', async () => {
    const { user, fetchMock } = setup({
      'POST /projects': { id: 30, name: 'Search', description: '', cluster_id: 2 },
    })
    await screen.findByRole('heading', { name: 'Payments' })
    await user.click(screen.getByRole('tab', { name: 'Core Platform' }))
    await user.click(screen.getByRole('button', { name: '+ Project' }))

    const dialog = screen.getByRole('dialog', { name: 'Create project' })
    const cluster = within(dialog).getByLabelText('Cluster')
    expect(cluster).toBeDisabled()
    expect(cluster).toHaveValue('2')
    expect(
      within(dialog).getByText('The project will be created in the currently selected cluster.'),
    ).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Project name'), 'Search')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    await waitFor(() =>
      expect(requestBody(fetchMock, 'POST /projects')).toEqual({
        name: 'Search',
        description: '',
        cluster_id: 2,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('edits a project and can move it to another cluster', async () => {
    const { user, fetchMock } = setup({
      'PATCH /projects/10': { id: 10, name: 'Payment Gateway', description: '', cluster_id: 2 },
    })
    await screen.findByRole('heading', { name: 'Payments' })
    await user.click(screen.getByRole('button', { name: 'Actions for project Payment Gateway' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit project' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit project' })
    expect(within(dialog).getByLabelText('Project name')).toHaveValue('Payment Gateway')
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Core card payment processing')
    const cluster = within(dialog).getByLabelText('Cluster')
    expect(cluster).toBeEnabled()
    expect(
      within(dialog).getByText(
        'Changing the cluster will move this project to the selected cluster.',
      ),
    ).toBeInTheDocument()

    await user.selectOptions(cluster, 'Core Platform')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(requestBody(fetchMock, 'PATCH /projects/10')).toMatchObject({ cluster_id: 2 }),
    )
  })

  it('shows server validation errors in the form', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /dashboard': dashboard,
      'GET /engineers': engineersOverview,
      'POST /clusters': () => ({
        status: 409,
        body: {
          error: {
            code: 'conflict',
            message: 'Cluster named “Payments” already exists.',
            fields: { name: 'Cluster named “Payments” already exists.' },
          },
        },
      }),
    })
    renderWithProviders(<DashboardPage />)
    await screen.findByRole('heading', { name: 'Payments' })
    await user.click(screen.getByRole('button', { name: '+ Cluster' }))
    const dialog = screen.getByRole('dialog', { name: 'Create cluster' })
    await user.type(within(dialog).getByLabelText('Cluster name'), 'Payments')
    await user.click(within(dialog).getByRole('button', { name: 'Create cluster' }))

    expect(
      await within(dialog).findByText('Cluster named “Payments” already exists.'),
    ).toBeVisible()
    expect(within(dialog).getByLabelText('Cluster name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('explains why a cluster with projects cannot be deleted', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'Payments' })
    await user.click(screen.getByRole('button', { name: 'Actions for cluster Payments' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete cluster' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete cluster' })
    expect(within(dialog).getByText(/still has 1 project/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Delete cluster' })).not.toBeInTheDocument()
  })

  it('deletes an empty cluster after confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /dashboard': dashboard,
      'DELETE /clusters/3': () => ({ status: 204 }),
    })
    renderWithProviders(<DashboardPage />)
    await screen.findByRole('heading', { name: 'Payments' })
    await user.click(screen.getByRole('tab', { name: 'New Initiatives' }))
    await user.click(screen.getByRole('button', { name: 'Actions for cluster New Initiatives' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete cluster' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete cluster' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete cluster' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
  })
})
