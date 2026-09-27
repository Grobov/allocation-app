import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
}

test('dashboard has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible()
  await expectNoViolations(page)
  // Planned allocations and empty projects.
  await page.getByRole('tab', { name: 'Core Platform' }).click()
  await expect(page.getByText('Planned · 50%')).toBeVisible()
  await expectNoViolations(page)
})

test('allocation dialog has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit allocation of Anna Melnyk' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit allocation' })).toBeVisible()
  await expectNoViolations(page)
})

test('engineers page has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/engineers')
  await expect(page.getByRole('rowheader', { name: 'Anna Melnyk' })).toBeVisible()
  await expectNoViolations(page)
})
