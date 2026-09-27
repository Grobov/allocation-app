import { expect, test, type Locator, type Page } from '@playwright/test'

// Runs against the real backend with a freshly migrated and seeded database (see
// playwright.config.ts). Tests run serially and each uses its own entity names.
test.describe.configure({ mode: 'serial' })

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const today = new Date()
const todayLabel = `${String(today.getDate()).padStart(2, '0')} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`

const metric = (page: Page, label: string) =>
  page
    .getByLabel('Summary')
    .locator('.metric')
    .filter({ has: page.getByText(label, { exact: true }) })

const projectCard = (page: Page, name: string) => page.getByRole('article', { name })

const allocationCard = (project: Locator, engineer: string) =>
  project.getByRole('listitem').filter({ hasText: engineer })

async function openProjectMenu(page: Page, project: string, item: string) {
  await page.getByRole('button', { name: `Actions for project ${project}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('dashboard and engineers reflect the seeded data', async ({ page }) => {
  await page.goto('/')
  await expect(metric(page, 'Clusters')).toContainText('3')
  await expect(metric(page, 'Projects')).toContainText('5')
  await expect(metric(page, 'Engineers')).toContainText('8')
  await expect(metric(page, 'Unallocated engineer')).toContainText('1')

  await expect(page.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('QA Manager: Olena Kovalenko')).toBeVisible()
  const gateway = projectCard(page, 'Payment Gateway')
  await expect(allocationCard(gateway, 'Anna Melnyk')).toContainText('100%')
  await expect(allocationCard(gateway, 'Maksym Bondar')).toContainText('QC Lead')

  await page.getByRole('tab', { name: 'Core Platform' }).click()
  await expect(projectCard(page, 'Notification Service')).toContainText('No QA engineers allocated')
  await expect(projectCard(page, 'Data Platform')).toContainText('Planned · 50%')

  await page.getByRole('tab', { name: 'New Initiatives' }).click()
  await expect(page.getByText('QA Manager: Not assigned')).toBeVisible()
  await expect(page.getByText('No projects in this cluster.')).toBeVisible()

  await page.getByRole('link', { name: 'Engineers' }).click()
  const row = (name: string) =>
    page.getByRole('row').filter({ has: page.getByRole('rowheader', { name }) })
  await expect(row('Maksym Bondar')).toContainText('Payment Gateway · QC Lead · 50%')
  await expect(row('Maksym Bondar')).toContainText('Merchant Portal · QC · 25%')
  await expect(row('Maksym Bondar')).toContainText('75%')
  await expect(row('Kateryna Romanenko')).toContainText('(planned)')
  await expect(row('Andrii Koval')).toContainText('Unallocated')
  await expect(row('Olena Kovalenko')).toContainText('Cluster manager: Payments')
})

test('cluster create, edit and delete', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '+ Cluster' }).click()
  let dialog = page.getByRole('dialog', { name: 'Create cluster' })
  await dialog.getByLabel('Cluster name').fill('Customer Experience')
  await dialog.getByLabel('QA Manager').selectOption({ label: 'Serhii Tkachenko' })
  await dialog.getByRole('button', { name: 'Create cluster' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('tab', { name: 'Customer Experience' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('QA Manager: Serhii Tkachenko')).toBeVisible()
  await expect(metric(page, 'Clusters')).toContainText('4')

  // Duplicate names are rejected with a field error.
  await page.getByRole('button', { name: '+ Cluster' }).click()
  dialog = page.getByRole('dialog', { name: 'Create cluster' })
  await dialog.getByLabel('Cluster name').fill('customer experience')
  await dialog.getByRole('button', { name: 'Create cluster' }).click()
  await expect(dialog.getByText(/already exists/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Actions for cluster Customer Experience' }).click()
  await page.getByRole('menuitem', { name: 'Edit cluster' }).click()
  dialog = page.getByRole('dialog', { name: 'Edit cluster' })
  await expect(dialog.getByLabel('Cluster name')).toHaveValue('Customer Experience')
  await dialog.getByLabel('Cluster name').fill('Customer Care')
  await dialog.getByLabel('QA Manager').selectOption({ label: 'Not assigned' })
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Customer Care' })).toBeVisible()
  await expect(page.getByText('QA Manager: Not assigned')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for cluster Customer Care' }).click()
  await page.getByRole('menuitem', { name: 'Delete cluster' }).click()
  await page
    .getByRole('dialog', { name: 'Delete cluster' })
    .getByRole('button', { name: 'Delete cluster' })
    .click()
  await expect(page.getByRole('tab', { name: 'Customer Care' })).toHaveCount(0)
  await expect(metric(page, 'Clusters')).toContainText('3')
})

test('project and allocation workflow', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'New Initiatives' }).click()
  await page.getByRole('button', { name: 'Create first project' }).click()

  // Create: the cluster is fixed to the selected one.
  let dialog = page.getByRole('dialog', { name: 'Create project' })
  await expect(dialog.getByLabel('Cluster')).toBeDisabled()
  await expect(dialog.getByLabel('Cluster')).toHaveValue(/\d+/)
  await expect(dialog.getByLabel('Cluster').locator('option:checked')).toHaveText('New Initiatives')
  await dialog.getByLabel('Project name').fill('Mobile App')
  await dialog.getByLabel('Description').fill('iOS and Android clients')
  await dialog.getByRole('button', { name: 'Create project' }).click()

  const mobile = projectCard(page, 'Mobile App')
  await expect(mobile).toContainText('iOS and Android clients')
  await expect(mobile).toContainText('No QA engineers allocated')

  // Allocate the unallocated engineer.
  await mobile.getByRole('button', { name: '+ Allocate engineer' }).click()
  dialog = page.getByRole('dialog', { name: 'Allocate engineer' })
  await expect(dialog.getByLabel('Project', { exact: true })).toHaveValue('Mobile App')
  await expect(dialog.getByLabel('Project', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('button', { name: 'End allocation' })).toBeDisabled()
  await dialog.getByLabel('Engineer').selectOption({ label: 'Andrii Koval (0% allocated)' })
  await dialog.getByLabel('Role').selectOption('QC Lead')
  await dialog.getByLabel('Allocation %').fill('60')
  await dialog.getByLabel('Project-specific comment').fill('Owns mobile test strategy.')
  await dialog.getByRole('button', { name: 'Allocate engineer' }).click()

  const andrii = allocationCard(mobile, 'Andrii Koval')
  await expect(andrii).toContainText('QC Lead')
  await expect(andrii).toContainText('60%')
  await expect(andrii).toContainText('Owns mobile test strategy.')
  await expect(andrii).toContainText(`Active since ${todayLabel}`)
  await expect(metric(page, 'Unallocated engineers')).toContainText('0')

  // Over-allocation is rejected by the server and explained in the form.
  await mobile.getByRole('button', { name: '+ Allocate engineer' }).click()
  dialog = page.getByRole('dialog', { name: 'Allocate engineer' })
  await dialog.getByLabel('Engineer').selectOption({ label: 'Anna Melnyk (100% allocated)' })
  await dialog.getByLabel('Allocation %').fill('50')
  await dialog.getByRole('button', { name: 'Allocate engineer' }).click()
  await expect(dialog.getByText(/Anna Melnyk would be allocated 150%/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  // Edit: engineer is locked, project read-only.
  await andrii.getByRole('button', { name: 'Edit allocation of Andrii Koval' }).click()
  dialog = page.getByRole('dialog', { name: 'Edit allocation' })
  await expect(dialog.getByLabel('Engineer')).toBeDisabled()
  await expect(dialog.getByLabel('Role')).toHaveValue('QC Lead')
  await expect(dialog.getByLabel('Allocation %')).toHaveValue('60')
  await dialog.getByLabel('Allocation %').fill('80')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(andrii).toContainText('80%')

  // Move the project to another cluster via project editing.
  await openProjectMenu(page, 'Mobile App', 'Edit project')
  dialog = page.getByRole('dialog', { name: 'Edit project' })
  await expect(dialog.getByLabel('Cluster')).toBeEnabled()
  await dialog.getByLabel('Cluster').selectOption({ label: 'Core Platform' })
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('tab', { name: 'Core Platform' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(allocationCard(projectCard(page, 'Mobile App'), 'Andrii Koval')).toContainText('80%')
  await page.getByRole('tab', { name: 'New Initiatives' }).click()
  await expect(page.getByText('No projects in this cluster.')).toBeVisible()
  await page.getByRole('tab', { name: 'Core Platform' }).click()

  // A project with current allocations cannot be deleted.
  await openProjectMenu(page, 'Mobile App', 'Delete project')
  dialog = page.getByRole('dialog', { name: 'Delete project' })
  await expect(dialog).toContainText('has 1 current allocation')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  // End the allocation (kept as history, removed from the dashboard).
  await projectCard(page, 'Mobile App')
    .getByRole('button', { name: 'Edit allocation of Andrii Koval' })
    .click()
  await page
    .getByRole('dialog', { name: 'Edit allocation' })
    .getByRole('button', { name: 'End allocation' })
    .click()
  await page
    .getByRole('dialog', { name: 'End allocation' })
    .getByRole('button', { name: 'End allocation' })
    .click()
  await expect(projectCard(page, 'Mobile App')).toContainText('No QA engineers allocated')
  await expect(metric(page, 'Unallocated engineer')).toContainText('1')

  // Now the project can be deleted.
  await openProjectMenu(page, 'Mobile App', 'Delete project')
  await page
    .getByRole('dialog', { name: 'Delete project' })
    .getByRole('button', { name: 'Delete project' })
    .click()
  await expect(projectCard(page, 'Mobile App')).toHaveCount(0)
})

test('engineer lifecycle with persistence', async ({ page }) => {
  await page.goto('/engineers')
  await page.getByRole('button', { name: '+ Engineer' }).click()
  let dialog = page.getByRole('dialog', { name: 'Create engineer' })
  await dialog.getByLabel('Full name').fill('Oleksii Marchenko')
  await dialog.getByLabel('General comment').fill('Manual and API testing experience')
  await dialog.getByRole('button', { name: 'Create engineer' }).click()

  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Oleksii Marchenko' }) })
  await expect(row).toContainText('Manual and API testing experience')
  await expect(row).toContainText('Unallocated')

  // Data is persisted in the database.
  await page.reload()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Edit Oleksii Marchenko' }).click()
  dialog = page.getByRole('dialog', { name: 'Edit engineer' })
  await dialog.getByLabel('General comment').fill('Mobile testing')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(row).toContainText('Mobile testing')

  // Engineers with current allocations cannot be deleted.
  await page.getByRole('button', { name: 'Edit Anna Melnyk' }).click()
  await page
    .getByRole('dialog', { name: 'Edit engineer' })
    .getByRole('button', { name: 'Delete engineer' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Delete engineer' })).toContainText(
    'has 1 current allocation',
  )
  await page
    .getByRole('dialog', { name: 'Delete engineer' })
    .getByRole('button', { name: 'Close', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Edit engineer' })
    .getByRole('button', { name: 'Cancel' })
    .click()

  await row.getByRole('button', { name: 'Edit Oleksii Marchenko' }).click()
  await page
    .getByRole('dialog', { name: 'Edit engineer' })
    .getByRole('button', { name: 'Delete engineer' })
    .click()
  await page
    .getByRole('dialog', { name: 'Delete engineer' })
    .getByRole('button', { name: 'Delete engineer' })
    .click()
  await expect(row).toHaveCount(0)
})

test('keyboard: menus and dialogs', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Actions for project Payment Gateway' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Edit project' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Delete project' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Edit project' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
