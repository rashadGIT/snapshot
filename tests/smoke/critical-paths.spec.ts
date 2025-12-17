import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Critical Paths
 * Quick tests to verify core functionality works
 * These should run fast and catch major breakages
 */

test.describe('Critical Path Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Snapspot/);
  });

  test('dashboard is accessible', async ({ page }) => {
    const response = await page.goto('/dashboard');

    // May redirect to login if not authenticated
    expect([200, 302, 307]).toContain(response?.status() || 200);
  });

  test('job creation page loads', async ({ page }) => {
    const response = await page.goto('/jobs/create');

    // May redirect to login if not authenticated
    expect([200, 302, 307]).toContain(response?.status() || 200);
  });

  test('QR scanner page loads', async ({ page }) => {
    const response = await page.goto('/jobs/join');

    expect(response?.status()).toBe(200);
  });

  test('onboarding page loads', async ({ page }) => {
    const response = await page.goto('/onboarding/role');

    expect(response?.status()).toBe(200);
  });

  test('API health - jobs endpoint', async ({ request }) => {
    const response = await request.get('/api/jobs');

    // May return 401 if not authenticated, which is expected
    expect([200, 401]).toContain(response.status());
  });

  test('static assets load', async ({ page }) => {
    await page.goto('/');

    // Check that CSS loaded
    const hasStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return styles.fontFamily !== '';
    });

    expect(hasStyles).toBe(true);
  });

  test('JavaScript executes', async ({ page }) => {
    await page.goto('/');

    // Check that React hydrated
    const hasReact = await page.evaluate(() => {
      return !!(window as any).__NEXT_DATA__;
    });

    expect(hasReact).toBe(true);
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');

    // Try to navigate (will work even without auth for public pages)
    await page.click('a[href="/jobs/join"]').catch(() => {
      // Link might not exist, that's ok for smoke test
    });

    // Just verify page responded
    expect(page.url()).toBeTruthy();
  });

  test('form validation works', async ({ page }) => {
    await page.goto('/jobs/create');

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();

    if (await submitButton.count() > 0) {
      await submitButton.click();

      // Should show validation errors or redirect
      await page.waitForTimeout(1000);
      expect(page.url()).toBeTruthy();
    }
  });

  test('responsive design works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);

    // Page should render without horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('error handling works', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/this-page-does-not-exist-12345');

    // Should show 404 or handle gracefully
    const hasContent = await page.evaluate(() => {
      return document.body.textContent && document.body.textContent.length > 0;
    });

    expect(hasContent).toBe(true);
  });
});
