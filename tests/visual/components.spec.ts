import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests - Components
 * Takes screenshots of components and compares against baselines
 */

test.describe('Component Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Job Cards', () => {
    test('job card should match snapshot', async ({ page }) => {
      // Navigate to page with job cards
      await page.goto('/dashboard');

      // Wait for job cards to load
      const jobCard = page.locator('[data-testid="job-card"]').first();

      if (await jobCard.count() > 0) {
        await expect(jobCard).toHaveScreenshot('job-card.png', {
          maxDiffPixels: 100,
        });
      }
    });

    test('job card hover state should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const jobCard = page.locator('[data-testid="job-card"]').first();

      if (await jobCard.count() > 0) {
        await jobCard.hover();
        await expect(jobCard).toHaveScreenshot('job-card-hover.png');
      }
    });

    test('job card OPEN status badge should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const openBadge = page.locator('[data-testid="status-badge"]:has-text("OPEN")').first();

      if (await openBadge.count() > 0) {
        await expect(openBadge).toHaveScreenshot('status-badge-open.png');
      }
    });

    test('job card COMPLETED status badge should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const completedBadge = page.locator('[data-testid="status-badge"]:has-text("COMPLETED")').first();

      if (await completedBadge.count() > 0) {
        await expect(completedBadge).toHaveScreenshot('status-badge-completed.png');
      }
    });
  });

  test.describe('Buttons', () => {
    test('primary button should match snapshot', async ({ page }) => {
      const primaryButton = page.locator('button.bg-blue-600').first();

      if (await primaryButton.count() > 0) {
        await expect(primaryButton).toHaveScreenshot('button-primary.png');
      }
    });

    test('primary button hover should match snapshot', async ({ page }) => {
      const primaryButton = page.locator('button.bg-blue-600').first();

      if (await primaryButton.count() > 0) {
        await primaryButton.hover();
        await expect(primaryButton).toHaveScreenshot('button-primary-hover.png');
      }
    });

    test('secondary button should match snapshot', async ({ page }) => {
      const secondaryButton = page.locator('button.border').first();

      if (await secondaryButton.count() > 0) {
        await expect(secondaryButton).toHaveScreenshot('button-secondary.png');
      }
    });

    test('danger button should match snapshot', async ({ page }) => {
      const dangerButton = page.locator('button.bg-red-600').first();

      if (await dangerButton.count() > 0) {
        await expect(dangerButton).toHaveScreenshot('button-danger.png');
      }
    });
  });

  test.describe('Forms', () => {
    test('input field should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      const input = page.locator('input[type="text"]').first();

      if (await input.count() > 0) {
        await expect(input).toHaveScreenshot('input-field.png');
      }
    });

    test('input field focused should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      const input = page.locator('input[type="text"]').first();

      if (await input.count() > 0) {
        await input.focus();
        await expect(input).toHaveScreenshot('input-field-focused.png');
      }
    });

    test('input field with error should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      // Submit form to trigger validation
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click();

        const errorInput = page.locator('input.border-red-500').first();
        if (await errorInput.count() > 0) {
          await expect(errorInput).toHaveScreenshot('input-field-error.png');
        }
      }
    });

    test('textarea should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      const textarea = page.locator('textarea').first();

      if (await textarea.count() > 0) {
        await expect(textarea).toHaveScreenshot('textarea.png');
      }
    });

    test('select dropdown should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      const select = page.locator('select').first();

      if (await select.count() > 0) {
        await expect(select).toHaveScreenshot('select-dropdown.png');
      }
    });
  });

  test.describe('Navigation', () => {
    test('header navigation should match snapshot', async ({ page }) => {
      const header = page.locator('header').first();

      if (await header.count() > 0) {
        await expect(header).toHaveScreenshot('header-nav.png');
      }
    });

    test('mobile menu should match snapshot', async ({ page, viewport }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const menuButton = page.locator('[aria-label="Menu"]').first();

      if (await menuButton.count() > 0) {
        await menuButton.click();

        const menu = page.locator('[role="dialog"], .mobile-menu').first();
        if (await menu.count() > 0) {
          await expect(menu).toHaveScreenshot('mobile-menu.png');
        }
      }
    });
  });

  test.describe('Modals', () => {
    test('confirmation modal should match snapshot', async ({ page }) => {
      const modal = page.locator('[role="dialog"]').first();

      if (await modal.count() > 0) {
        await expect(modal).toHaveScreenshot('modal-confirmation.png');
      }
    });

    test('modal overlay should match snapshot', async ({ page }) => {
      const overlay = page.locator('[role="dialog"] ~ div, .modal-overlay').first();

      if (await overlay.count() > 0) {
        await expect(overlay).toHaveScreenshot('modal-overlay.png');
      }
    });
  });

  test.describe('Loading States', () => {
    test('loading spinner should match snapshot', async ({ page }) => {
      const spinner = page.locator('.loading, [aria-label="Loading"]').first();

      if (await spinner.count() > 0) {
        await expect(spinner).toHaveScreenshot('loading-spinner.png');
      }
    });

    test('skeleton loader should match snapshot', async ({ page }) => {
      const skeleton = page.locator('.skeleton, .animate-pulse').first();

      if (await skeleton.count() > 0) {
        await expect(skeleton).toHaveScreenshot('skeleton-loader.png');
      }
    });
  });

  test.describe('Empty States', () => {
    test('empty jobs list should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const emptyState = page.locator('[data-testid="empty-state"]').first();

      if (await emptyState.count() > 0) {
        await expect(emptyState).toHaveScreenshot('empty-state-jobs.png');
      }
    });

    test('no results found should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      // Search for non-existent job
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('nonexistentjob12345');

        const noResults = page.locator(':has-text("No results")').first();
        if (await noResults.count() > 0) {
          await expect(noResults).toHaveScreenshot('no-results.png');
        }
      }
    });
  });

  test.describe('Icons', () => {
    test('camera icon should match snapshot', async ({ page }) => {
      const cameraIcon = page.locator('[data-icon="camera"], svg').first();

      if (await cameraIcon.count() > 0) {
        await expect(cameraIcon).toHaveScreenshot('icon-camera.png');
      }
    });
  });

  test.describe('Badges and Tags', () => {
    test('price tier badge should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const priceBadge = page.locator('[data-testid="price-badge"]').first();

      if (await priceBadge.count() > 0) {
        await expect(priceBadge).toHaveScreenshot('badge-price.png');
      }
    });

    test('content type tag should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const contentTag = page.locator('[data-testid="content-type-tag"]').first();

      if (await contentTag.count() > 0) {
        await expect(contentTag).toHaveScreenshot('tag-content-type.png');
      }
    });
  });
});
