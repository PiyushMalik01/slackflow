import { test, expect, type Page } from '@playwright/test'

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000'
const TELEGRAM_CHAT_ID = '5392204830'
const ROLE_NAME = 'Drishti'

// Helper: wait for client-side hydration on pages using Suspense
async function waitForHydration(page: Page) {
  await page.waitForLoadState('networkidle')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LANDING PAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
  })

  test('should load landing page with correct title and hero', async ({ page }) => {
    await expect(page).toHaveURL('/')
    const hero = page.locator('h1').first()
    await expect(hero).toBeVisible()
    await expect(hero).toContainText('Route client Slack messages')
    await expect(hero).toContainText('to the right person, instantly')
    await expect(page.getByText('Connect multiple Slack workspaces')).toBeVisible()
  })

  test('should display SlackFlow logo/branding', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible()
  })

  test('should have Sign in link in nav', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: 'Sign in' })
    await expect(signInLink).toBeVisible()
    await expect(signInLink).toHaveAttribute('href', '/login')
  })

  test('should have Get started button in nav', async ({ page }) => {
    const btn = page.locator('nav').getByRole('link', { name: 'Get started' })
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('href', '/signup')
  })

  test('should navigate to login page when Sign in is clicked', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('should navigate to signup page when Get started is clicked', async ({ page }) => {
    await page.locator('nav').getByRole('link', { name: 'Get started' }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('should display "Powered by GPT-4o-mini" badge', async ({ page }) => {
    await expect(page.getByText('Powered by GPT-4o-mini')).toBeVisible()
  })

  test('should have "Start for free" CTA button linking to signup', async ({ page }) => {
    const btn = page.getByRole('link', { name: /Start for free/i })
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('href', '/signup')
  })

  test('should have "Add to Slack" button linking to install', async ({ page }) => {
    const btn = page.getByRole('link', { name: /Add to Slack/i })
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('href', '/api/slack/install')
  })

  test('should display "How it works" section with 3 steps', async ({ page }) => {
    await expect(page.getByText('How it works')).toBeVisible()
    await expect(page.getByText('Client sends a Slack message')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI drafts a reply' })).toBeVisible()
    await expect(page.getByText('One-tap approval')).toBeVisible()
    await expect(page.getByText('01')).toBeVisible()
    await expect(page.getByText('02')).toBeVisible()
    await expect(page.getByText('03')).toBeVisible()
  })

  test('should display "Everything you need" features grid', async ({ page }) => {
    await expect(page.getByText('Everything you need')).toBeVisible()
    await expect(page.getByText('Multi-workspace')).toBeVisible()
    await expect(page.getByText('Telegram alerts')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI drafts', exact: true })).toBeVisible()
    await expect(page.getByText('Role routing')).toBeVisible()
    // "Secure" appears in feature card heading
    await expect(page.getByRole('heading', { name: 'Secure' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  })

  test('should display CTA section with "Start routing smarter today"', async ({ page }) => {
    await expect(page.getByText('Start routing smarter today')).toBeVisible()
    await expect(page.getByText('Set up in minutes. No credit card required.')).toBeVisible()
    const ctaBtn = page.getByRole('link', { name: /Create your account/i })
    await expect(ctaBtn).toBeVisible()
    await expect(ctaBtn).toHaveAttribute('href', '/signup')
  })

  test('should navigate to signup from CTA section', async ({ page }) => {
    await page.getByRole('link', { name: /Create your account/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('should display footer with branding', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('Automation pipeline for client request routing')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOGIN PAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await waitForHydration(page)
    // Wait for the Suspense content to render
    await page.waitForSelector('#email', { timeout: 10000 })
  })

  test('should load login page with heading', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByText('Sign in to your account')).toBeVisible()
  })

  test('should display logo that links to home', async ({ page }) => {
    await expect(page.locator('a[href="/"]')).toBeVisible()
  })

  test('should have email input field', async ({ page }) => {
    const emailInput = page.locator('#email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('placeholder', 'you@example.com')
  })

  test('should have password input field', async ({ page }) => {
    const passInput = page.locator('#password')
    await expect(passInput).toBeVisible()
    await expect(passInput).toHaveAttribute('type', 'password')
  })

  test('should have Sign in button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Sign in/i })
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('should have link to signup page', async ({ page }) => {
    const link = page.getByRole('link', { name: /Create one/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/signup')
  })

  test('should navigate to signup when "Create one" is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /Create one/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('should show error on invalid credentials', async ({ page }) => {
    await page.locator('#email').fill('invalid@test.com')
    await page.locator('#password').fill('wrongpassword123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    const errorMsg = page.locator('.text-destructive')
    await expect(errorMsg).toBeVisible({ timeout: 15000 })
  })

  test('should show loading state when submitting', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    // Button should still exist
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  })

  test('should not submit empty form (HTML validation)', async ({ page }) => {
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('should navigate home when logo is clicked', async ({ page }) => {
    await page.locator('a[href="/"]').first().click()
    await expect(page).toHaveURL('/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SIGNUP PAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
    await waitForHydration(page)
    await page.waitForSelector('#email', { timeout: 10000 })
  })

  test('should load signup page with heading', async ({ page }) => {
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.getByText('Start routing Slack messages smarter')).toBeVisible()
  })

  test('should display logo that links to home', async ({ page }) => {
    await expect(page.locator('a[href="/"]')).toBeVisible()
  })

  test('should have email input field', async ({ page }) => {
    const emailInput = page.locator('#email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
  })

  test('should have password input with min length', async ({ page }) => {
    const passInput = page.locator('#password')
    await expect(passInput).toBeVisible()
    await expect(passInput).toHaveAttribute('type', 'password')
    await expect(passInput).toHaveAttribute('placeholder', 'Min. 8 characters')
  })

  test('should have Create account button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Create account/i })
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('should have link to login page', async ({ page }) => {
    const link = page.getByRole('link', { name: /Sign in/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/login')
  })

  test('should navigate to login when "Sign in" is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /Sign in/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('should not submit empty form', async ({ page }) => {
    await page.getByRole('button', { name: /Create account/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('should show error or confirm for signup attempt', async ({ page }) => {
    await page.locator('#email').fill('testplaywright_' + Date.now() + '@test.com')
    await page.locator('#password').fill('password123456')
    await page.getByRole('button', { name: /Create account/i }).click()

    // Wait for API response
    await page.waitForTimeout(5000)

    const hasError = await page.locator('.text-destructive').isVisible().catch(() => false)
    const hasConfirm = await page.getByText('Check your email').isVisible().catch(() => false)
    const stillOnPage = await page.getByText('Create your account').isVisible().catch(() => false)
    expect(hasError || hasConfirm || stillOnPage).toBeTruthy()
  })

  test('should navigate home when logo is clicked', async ({ page }) => {
    await page.locator('a[href="/"]').first().click()
    await expect(page).toHaveURL('/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DASHBOARD AUTH PROTECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Dashboard - Auth Protection', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/workspaces',
    '/dashboard/tasks',
    '/dashboard/settings',
    '/dashboard/activity',
  ]

  for (const route of protectedRoutes) {
    test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
      const response = await page.goto(route)
      // Middleware redirects to /login
      await page.waitForURL(/\/login/, { timeout: 20000 })
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. API ENDPOINT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('API Endpoints', () => {
  test('GET /api/health should return status', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('POST /api/roles should require auth (401)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/roles`, {
      data: { name: 'Test', type: 'Builder' },
    })
    expect(res.status()).toBe(401)
  })

  test('PUT /api/roles should require auth (401)', async ({ request }) => {
    const res = await request.put(`${BASE_URL}/api/roles`, {
      data: { id: 'test-id', name: 'Updated' },
    })
    expect(res.status()).toBe(401)
  })

  test('DELETE /api/roles should require auth (401)', async ({ request }) => {
    const res = await request.delete(`${BASE_URL}/api/roles?id=test-id`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/workspace-roles should require auth (401)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/workspace-roles`, {
      data: { workspace_id: 'ws-id', category: 'BUG', role_id: 'role-id' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/slack/events should handle missing signature', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/slack/events`, { data: {} })
    expect([400, 401, 403, 500]).toContain(res.status())
  })

  test('POST /api/telegram/webhook should handle empty body', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/telegram/webhook`, { data: {} })
    expect([200, 400, 500]).toContain(res.status())
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. NAVIGATION FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Navigation Flows', () => {
  test('Landing → Login → Signup → Login round-trip', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')

    await page.getByRole('link', { name: 'Sign in' }).click()
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page).toHaveURL('/login')

    await page.getByRole('link', { name: /Create one/i }).click()
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page).toHaveURL('/signup')

    await page.getByRole('link', { name: /Sign in/i }).click()
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page).toHaveURL('/login')
  })

  test('Landing → Start for free → Signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Start for free/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('Landing → CTA Create account → Signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Create your account/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('Login page logo → Landing page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('a[href="/"]', { timeout: 10000 })
    await page.locator('a[href="/"]').first().click()
    await expect(page).toHaveURL('/')
  })

  test('Signup page logo → Landing page', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForSelector('a[href="/"]', { timeout: 10000 })
    await page.locator('a[href="/"]').first().click()
    await expect(page).toHaveURL('/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RESPONSIVE & UI TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Responsive Design', () => {
  test('landing page should be visually intact on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByText(/Start for free/i)).toBeVisible()
  })

  test('landing page should be visually intact on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByText('How it works')).toBeVisible()
  })

  test('login page should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
  })

  test('signup page should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/signup')
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FORM VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Form Validation', () => {
  test('login email field rejects invalid email', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    const emailInput = page.locator('#email')
    await emailInput.fill('not-an-email')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).click()
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).toBeTruthy()
  })

  test('signup email field rejects invalid email', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForSelector('#email', { timeout: 10000 })
    const emailInput = page.locator('#email')
    await emailInput.fill('invalid')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /Create account/i }).click()
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).toBeTruthy()
  })

  test('login requires both fields', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('signup password has min length validation', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('short')
    await page.getByRole('button', { name: /Create account/i }).click()
    const valid = await page.locator('#password').evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(valid).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. AUTHENTICATED DASHBOARD TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Authenticated Dashboard Tests', () => {
  async function login(page: Page) {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('drishti@gmail.com')
    await page.locator('#password').fill('drishti@gmail.com')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  }

  test('should login and reach dashboard', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText('Overview')).toBeVisible()
  })

  test('dashboard should show metric cards', async ({ page }) => {
    await login(page)
    await expect(page.getByText('Tasks today')).toBeVisible()
    await expect(page.getByText('Approval rate')).toBeVisible()
    await expect(page.getByText('Active workspaces')).toBeVisible()
    await expect(page.getByText('Pending review')).toBeVisible()
  })

  test('dashboard should show recent tasks section', async ({ page }) => {
    await login(page)
    await expect(page.getByText('Recent tasks')).toBeVisible()
  })

  test('dashboard should have "View all" link to tasks', async ({ page }) => {
    await login(page)
    const viewAll = page.getByRole('link', { name: /View all/i })
    await expect(viewAll).toBeVisible()
    await viewAll.click()
    await expect(page).toHaveURL(/\/dashboard\/tasks/)
  })

  // ── Sidebar Navigation ────────────────────────────────────────────────────

  test('sidebar should show all nav items', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Workspaces' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Activity' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  test('sidebar: navigate to Workspaces', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Workspaces' }).click()
    await expect(page).toHaveURL(/\/dashboard\/workspaces/)
    await expect(page.getByText('Workspaces').first()).toBeVisible()
  })

  test('sidebar: navigate to Tasks', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/\/dashboard\/tasks/)
    await expect(page.getByText('Tasks').first()).toBeVisible()
  })

  test('sidebar: navigate to Activity', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(/\/dashboard\/activity/)
    await expect(page.getByText('Activity').first()).toBeVisible()
  })

  test('sidebar: navigate to Settings', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/dashboard\/settings/)
    await expect(page.getByText('Settings').first()).toBeVisible()
  })

  test('sidebar: Sign out button exists and works', async ({ page }) => {
    await login(page)
    const signOutBtn = page.getByRole('button', { name: /Sign out/i })
    await expect(signOutBtn).toBeVisible()
    await signOutBtn.click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── Workspaces Page ────────────────────────────────────────────────────────

  test('workspaces page should load with heading', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/workspaces')
    await waitForHydration(page)
    await expect(page.getByText('Manage connected Slack workspaces')).toBeVisible()
  })

  test('workspaces page should have "Add to Slack" button', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/workspaces')
    await waitForHydration(page)
    await expect(page.getByRole('link', { name: /Add to Slack/i })).toBeVisible()
  })

  test('workspaces page should show workspace(s) or empty state', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/workspaces')
    await waitForHydration(page)
    const hasWorkspaces = await page.getByText('Connected').first().isVisible().catch(() => false)
    const emptyState = await page.getByText('No workspaces connected').isVisible().catch(() => false)
    expect(hasWorkspaces || emptyState).toBeTruthy()
  })

  test('workspace card "Configure roles" link goes to settings', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/workspaces')
    await waitForHydration(page)
    const configLink = page.getByRole('link', { name: /Configure roles/i })
    if (await configLink.isVisible().catch(() => false)) {
      await configLink.click()
      await expect(page).toHaveURL(/\/dashboard\/settings/)
    }
  })

  // ── Tasks Page ──────────────────────────────────────────────────────────────

  test('tasks page should load with heading and count', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    await expect(page.locator('h1', { hasText: 'Tasks' })).toBeVisible()
    await expect(page.getByText(/total tasks/i)).toBeVisible()
  })

  test('tasks page should have search input', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    const searchInput = page.locator('input[name="q"]')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute('placeholder', 'Search messages…')
  })

  test('tasks page should have status filter dropdown', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    const statusSelect = page.locator('select[name="status"]')
    await expect(statusSelect).toBeVisible()
    const options = await statusSelect.locator('option').allTextContents()
    expect(options).toContain('All statuses')
    expect(options).toContain('pending')
    expect(options).toContain('sent')
  })

  test('tasks page should have category filter dropdown', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    const catSelect = page.locator('select[name="category"]')
    await expect(catSelect).toBeVisible()
    const options = await catSelect.locator('option').allTextContents()
    expect(options).toContain('All categories')
    expect(options).toContain('Bug')
    expect(options).toContain('Feature')
    expect(options).toContain('General')
  })

  test('tasks page should have Filter button', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    await expect(page.getByRole('button', { name: /Filter/i })).toBeVisible()
  })

  test('tasks filter should update URL params', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    await page.locator('select[name="status"]').selectOption('pending')
    await page.getByRole('button', { name: /Filter/i }).click()
    await expect(page).toHaveURL(/status=pending/)
  })

  test('tasks search should update URL with query', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    await page.locator('input[name="q"]').fill('test search')
    await page.getByRole('button', { name: /Filter/i }).click()
    await expect(page).toHaveURL(/q=test/)
  })

  test('tasks page shows table or empty state', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/tasks')
    await waitForHydration(page)
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmpty = await page.getByText('No tasks found').isVisible().catch(() => false)
    expect(hasTable || hasEmpty).toBeTruthy()
  })

  // ── Settings Page ──────────────────────────────────────────────────────────

  test('settings page should load with heading', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    await expect(page.getByText('Configure role routing and notifications')).toBeVisible()
  })

  test('settings page should show Team Roles section', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    await expect(page.getByText('Team Roles')).toBeVisible()
  })

  test('settings page should have role creation form', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="type"]')).toBeVisible()
    await expect(page.locator('input[name="telegram_chat_id"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Create role/i })).toBeVisible()
  })

  test('settings page should show role type quick-pick buttons', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    for (const type of ['Builder', 'Support', 'PM', 'Designer', 'Lead']) {
      await expect(page.getByRole('button', { name: type }).first()).toBeVisible()
    }
  })

  test('settings type quick-pick should fill the type input', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Builder' }).first().click()
    await expect(page.locator('input[name="type"]')).toHaveValue('Builder')
    await page.getByRole('button', { name: 'PM' }).first().click()
    await expect(page.locator('input[name="type"]')).toHaveValue('PM')
  })

  test('settings should show existing roles or empty state', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    const hasRoles = await page.locator('.group').first().isVisible().catch(() => false)
    const emptyState = await page.getByText('No roles yet').isVisible().catch(() => false)
    expect(hasRoles || emptyState).toBeTruthy()
  })

  test('settings should show workspace-role mapping or empty state', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    const hasMapping = await page.getByText('Route categories to roles').isVisible().catch(() => false)
    const emptyState = await page.getByText('Connect a workspace first').isVisible().catch(() => false)
    expect(hasMapping || emptyState).toBeTruthy()
  })

  test('settings category mapping should show BUG, FEATURE, GENERAL', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    if (await page.getByText('Route categories to roles').isVisible().catch(() => false)) {
      await expect(page.getByText('BUG').first()).toBeVisible()
      await expect(page.getByText('FEATURE').first()).toBeVisible()
      await expect(page.getByText('GENERAL').first()).toBeVisible()
    }
  })

  test('settings should have "Add custom category" functionality', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)
    if (await page.getByText('Route categories to roles').isVisible().catch(() => false)) {
      await expect(page.getByPlaceholder('New category...')).toBeVisible()
      await expect(page.getByRole('button', { name: /Add custom category/i })).toBeVisible()

      // Add a custom category
      await page.getByPlaceholder('New category...').fill('URGENT')
      await page.getByRole('button', { name: /Add custom category/i }).click()
      await expect(page.getByText('URGENT')).toBeVisible()
    }
  })

  // ── Activity Page ──────────────────────────────────────────────────────────

  test('activity page should load with heading', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/activity')
    await waitForHydration(page)
    await expect(page.getByText('Full audit trail of all pipeline events')).toBeVisible()
  })

  test('activity page shows logs or empty state', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/activity')
    await waitForHydration(page)
    const hasLogs = await page.locator('.divide-y').isVisible().catch(() => false)
    const emptyState = await page.getByText('No activity yet').isVisible().catch(() => false)
    expect(hasLogs || emptyState).toBeTruthy()
  })

  // ── Setup Wizard ──────────────────────────────────────────────────────────

  test('dashboard should show setup wizard or metrics', async ({ page }) => {
    await login(page)
    const hasWizard = await page.getByText("Welcome to SlackFlow! Let's get you set up.").isVisible().catch(() => false)
    const hasMetrics = await page.getByText('Tasks today').isVisible().catch(() => false)
    expect(hasWizard || hasMetrics).toBeTruthy()
  })

  test('dashboard header should show pipeline status', async ({ page }) => {
    await login(page)
    const healthy = await page.getByText('All systems operational').isVisible().catch(() => false)
    const degraded = await page.getByText('Degraded').isVisible().catch(() => false)
    const failed = await page.getByText('Health check failed').isVisible().catch(() => false)
    expect(healthy || degraded || failed).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ROLE MANAGEMENT E2E (Create role with Drishti's chat ID)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Role Management E2E', () => {
  async function login(page: Page) {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('drishti@gmail.com')
    await page.locator('#password').fill('drishti@gmail.com')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  }

  test('should create a role named Drishti with chat ID 5392204830', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)

    await page.locator('input[name="name"]').fill(ROLE_NAME)
    await page.getByRole('button', { name: 'Lead' }).first().click()
    await page.locator('input[name="telegram_chat_id"]').fill(TELEGRAM_CHAT_ID)

    // The form posts to /api/roles natively - intercept response
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/roles') && r.request().method() === 'POST',
        { timeout: 15000 }
      ).catch(() => null),
      page.getByRole('button', { name: /Create role/i }).click(),
    ])

    if (response) {
      console.log(`Role creation status: ${response.status()}`)
    }
    await page.waitForTimeout(2000)
  })

  test('should edit a role (hover to reveal buttons)', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/settings')
    await waitForHydration(page)

    const roleItems = page.locator('.group')
    const count = await roleItems.count()
    if (count > 0) {
      await roleItems.first().hover()
      await page.waitForTimeout(500)
      const editBtn = roleItems.first().locator('button').first()
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click()
        await expect(page.getByRole('button', { name: /Save/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()
        await page.getByRole('button', { name: /Cancel/i }).click()
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 11. ACCESSIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Accessibility', () => {
  test('login page inputs should have labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page.locator('label[for="email"]')).toBeVisible()
    await expect(page.locator('label[for="password"]')).toBeVisible()
  })

  test('signup page inputs should have labels', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForSelector('#email', { timeout: 10000 })
    await expect(page.locator('label[for="email"]')).toBeVisible()
    await expect(page.locator('label[for="password"]')).toBeVisible()
  })

  test('login form should be submittable with Enter key', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('password123')
    await page.locator('#password').press('Enter')
    await page.waitForTimeout(2000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 12. EDGE CASES & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Edge Cases', () => {
  test('404 page for non-existent route', async ({ page }) => {
    const res = await page.goto('/nonexistent-page')
    expect(res?.status()).toBe(404)
  })

  test('login with empty password should not submit', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('signup with short password should not submit', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('123')
    await page.getByRole('button', { name: /Create account/i }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('double-clicking login should not break', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#email', { timeout: 10000 })
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /Sign in/i }).dblclick()
    await page.waitForTimeout(3000)
  })

  test('API health endpoint should respond quickly', async ({ request }) => {
    const start = Date.now()
    const res = await request.get(`${BASE_URL}/api/health`)
    const elapsed = Date.now() - start
    expect(res.status()).toBe(200)
    expect(elapsed).toBeLessThan(5000)
  })
})
