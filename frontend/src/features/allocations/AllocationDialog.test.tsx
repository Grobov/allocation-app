import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { dashboard, engineersOverview } from '../../test/fixtures'
import { mockApi, renderWithProviders, requestBody } from '../../test/utils'
import { AllocationDialog } from './AllocationDialog'

const gateway = dashboard.clusters[0]!.projects[0]!
const anna = gateway.allocations[0]!

describe('AllocationDialog', () => {
  it('allocates an engineer (create mode)', async () => {
    const fetchMock = mockApi({
      'GET /engineers/overview': engineersOverview,
      'POST /allocations': () => ({ status: 201, body: {} }),
    })
    const onClose = vi.fn<() => void>()
    const user = userEvent.setup()
    renderWithProviders(<AllocationDialog project={gateway} today="2026-09-27" onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'Allocate engineer' })
    const engineer = within(dialog).getByLabelText('Engineer')
    expect(engineer).toBeEnabled()
    expect(within(dialog).getByLabelText('Project')).toHaveAttribute('readonly')
    expect(within(dialog).getByLabelText('Project')).toHaveValue('Payment Gateway')
    expect(within(dialog).getByRole('button', { name: 'End allocation' })).toBeDisabled()
    expect(within(dialog).getByLabelText('Allocation %')).toHaveValue(100)
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-09-27')

    // Engineers already on the project are not offered again.
    await within(dialog).findByRole('option', { name: 'Andrii Koval (0% allocated)' })
    expect(within(dialog).queryByRole('option', { name: /Anna Melnyk/ })).not.toBeInTheDocument()

    await user.selectOptions(engineer, 'Andrii Koval (0% allocated)')
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'QC Lead')
    await user.clear(within(dialog).getByLabelText('Allocation %'))
    await user.type(within(dialog).getByLabelText('Allocation %'), '40')
    await user.type(within(dialog).getByLabelText('Project-specific comment'), 'Smoke tests')
    await user.click(within(dialog).getByRole('button', { name: 'Allocate engineer' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(requestBody(fetchMock, 'POST /allocations')).toEqual({
      engineer_id: 6,
      project_id: 10,
      role: 'QC Lead',
      percent: 40,
      comment: 'Smoke tests',
      start_date: '2026-09-27',
      end_date: null,
    })
  })

  it('validates input before submitting', async () => {
    const fetchMock = mockApi({ 'GET /engineers/overview': engineersOverview })
    const user = userEvent.setup()
    renderWithProviders(
      <AllocationDialog project={gateway} today="2026-09-27" onClose={vi.fn<() => void>()} />,
    )
    const dialog = screen.getByRole('dialog')

    await user.clear(within(dialog).getByLabelText('Allocation %'))
    await user.type(within(dialog).getByLabelText('Allocation %'), '150')
    await user.click(within(dialog).getByRole('button', { name: 'Allocate engineer' }))

    expect(within(dialog).getByText('Select an engineer.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a whole number from 1 to 100.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('edits an allocation with the engineer locked and can end it', async () => {
    const fetchMock = mockApi({
      'GET /engineers/overview': engineersOverview,
      'PATCH /allocations/100': {},
      'POST /allocations/100/end': {},
    })
    const onClose = vi.fn<() => void>()
    const user = userEvent.setup()
    renderWithProviders(
      <AllocationDialog project={gateway} allocation={anna} today="2026-09-27" onClose={onClose} />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Edit allocation' })
    expect(within(dialog).getByLabelText('Engineer')).toBeDisabled()
    expect(within(dialog).getByLabelText('Engineer')).toHaveDisplayValue('Anna Melnyk')
    expect(within(dialog).getByLabelText('Project-specific comment')).toHaveValue(
      'Backend and API testing.',
    )
    const end = within(dialog).getByRole('button', { name: 'End allocation' })
    expect(end).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

    await user.click(end)
    const confirm = screen.getByRole('dialog', { name: 'End allocation' })
    expect(within(confirm).getByText(/It will end today/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'End allocation' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/allocations/100/end'))).toBe(
      true,
    )
  })

  it('shows over-allocation errors from the server next to the percentage', async () => {
    mockApi({
      'GET /engineers/overview': engineersOverview,
      'PATCH /allocations/100': () => ({
        status: 422,
        body: {
          error: {
            code: 'validation_error',
            message: 'Anna Melnyk would be allocated 120% from 27 Sep 2026 (maximum is 100%).',
            fields: {
              percent: 'Anna Melnyk would be allocated 120% from 27 Sep 2026 (maximum is 100%).',
            },
          },
        },
      }),
    })
    const user = userEvent.setup()
    renderWithProviders(
      <AllocationDialog
        project={gateway}
        allocation={anna}
        today="2026-09-27"
        onClose={vi.fn<() => void>()}
      />,
    )
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText(/would be allocated 120%/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Allocation %')).toHaveAttribute('aria-invalid', 'true')
  })
})
