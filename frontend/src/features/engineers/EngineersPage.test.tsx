import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { engineersOverview } from '../../test/fixtures'
import { mockApi, renderWithProviders, requestBody } from '../../test/utils'
import { EngineersPage } from './EngineersPage'

describe('EngineersPage', () => {
  it('lists engineers with allocations, totals and status', async () => {
    mockApi({ 'GET /engineers/overview': engineersOverview })
    renderWithProviders(<EngineersPage />)

    const anna = (await screen.findByRole('rowheader', { name: 'Anna Melnyk' })).closest('tr')!
    expect(within(anna).getByText('Payment Gateway · QC · 100%')).toBeInTheDocument()
    expect(within(anna).getByText('Allocated')).toHaveClass('status')

    const kateryna = screen.getByRole('rowheader', { name: 'Kateryna Romanenko' }).closest('tr')!
    expect(within(kateryna).getByText('Data Platform · QC · 50% (planned)')).toBeInTheDocument()
    expect(within(kateryna).getByText('Planned')).toBeInTheDocument()

    const andrii = screen.getByRole('rowheader', { name: 'Andrii Koval' }).closest('tr')!
    expect(within(andrii).getByText('0%')).toBeInTheDocument()
    expect(within(andrii).getByText('Unallocated')).toHaveClass('status', 'unallocated')

    const olena = screen.getByRole('rowheader', { name: 'Olena Kovalenko' }).closest('tr')!
    expect(within(olena).getByText('Cluster manager: Payments')).toBeInTheDocument()
    expect(within(olena).getByText('Manager')).toBeInTheDocument()
  })

  it('creates an engineer', async () => {
    const fetchMock = mockApi({
      'GET /engineers/overview': engineersOverview,
      'POST /engineers': () => ({ status: 201, body: {} }),
    })
    const user = userEvent.setup()
    renderWithProviders(<EngineersPage />)
    await user.click(await screen.findByRole('button', { name: '+ Engineer' }))

    const dialog = screen.getByRole('dialog', { name: 'Create engineer' })
    expect(
      within(dialog).queryByRole('button', { name: 'Delete engineer' }),
    ).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Full name'), 'Oleksii Marchenko')
    await user.type(within(dialog).getByLabelText('General comment'), 'Manual and API testing')
    await user.click(within(dialog).getByRole('button', { name: 'Create engineer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requestBody(fetchMock, 'POST /engineers')).toEqual({
      full_name: 'Oleksii Marchenko',
      comment: 'Manual and API testing',
    })
  })

  it('edits an engineer and blocks deleting one with current allocations', async () => {
    const fetchMock = mockApi({
      'GET /engineers/overview': engineersOverview,
      'PATCH /engineers/1': {},
    })
    const user = userEvent.setup()
    renderWithProviders(<EngineersPage />)
    await user.click(await screen.findByRole('button', { name: 'Edit Anna Melnyk' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit engineer' })
    expect(within(dialog).getByLabelText('Full name')).toHaveValue('Anna Melnyk')
    await user.click(within(dialog).getByRole('button', { name: 'Delete engineer' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete engineer' })
    expect(within(confirm).getByText(/has 1 current allocation/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Close' }))

    const comment = within(dialog).getByLabelText('General comment')
    await user.clear(comment)
    await user.type(comment, 'Performance testing')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(requestBody(fetchMock, 'PATCH /engineers/1')).toEqual({
        full_name: 'Anna Melnyk',
        comment: 'Performance testing',
      }),
    )
  })
})
