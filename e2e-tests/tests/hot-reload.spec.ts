import { expect, test, Page } from '@playwright/test'
import { spawn } from 'child_process'
import { startVite } from '../utils/startVite'

test.describe.configure({ mode: 'serial' })

let page: Page
let vite: Awaited<ReturnType<typeof startVite>>

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()

  vite = await startVite('hot-reload-works')

  await page.goto(`http://localhost:${vite.port}`)
})

test('hot reaload works', async () => {
  const title = page.locator('data-testid=title')
  title.waitFor()

  await expect(title).toHaveCSS('color', 'rgb(255, 255, 0)')

  vite.updateFileLine('App.tsx', 7, 'color: red')

  await page.waitForTimeout(200)

  await expect(title).toHaveCSS('color', 'rgb(255, 0, 0)')

  vite.updateFileLine('App.tsx', 7, 'color: green')

  await page.waitForTimeout(200)

  await expect(title).toHaveCSS('color', 'rgb(0, 128, 0)')
})

test('style is keeped after reload', async () => {
  page.reload()

  const title = page.locator('data-testid=title')

  await expect(title).toHaveCSS('color', 'rgb(0, 128, 0)')
})
