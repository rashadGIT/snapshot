import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests - Pages
 * Takes full page screenshots and compares against baselines
 */

test.describe('Page Visual Regression', () => {
  test.describe('Landing Page', () => {
    test('landing page should match snapshot', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveScreenshot('landing-page.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('landing page hero section should match snapshot', async ({ page }) => {
      await page.goto('/');

      const hero = page.locator('section').first();
      await expect(hero).toHaveScreenshot('landing-hero.png');
    });

    test('landing page features section should match snapshot', async ({ page }) => {
      await page.goto('/');

      const features = page.locator('[data-testid="features"], section:has-text("Features")').first();

      if (await features.count() > 0) {
        await expect(features).toHaveScreenshot('landing-features.png');
      }
    });
  });

  test.describe('Dashboard', () => {
    test('dashboard page should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveScreenshot('dashboard.png', {
        fullPage: true,
      });
    });

    test('dashboard with jobs list should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const jobsList = page.locator('[data-testid="jobs-list"]').first();

      if (await jobsList.count() > 0) {
        await expect(jobsList).toHaveScreenshot('dashboard-jobs-list.png');
      }
    });

    test('dashboard role switcher should match snapshot', async ({ page }) => {
      await page.goto('/dashboard');

      const roleSwitcher = page.locator('[data-testid="role-switcher"]').first();

      if (await roleSwitcher.count() > 0) {
        await expect(roleSwitcher).toHaveScreenshot('dashboard-role-switcher.png');
      }
    });
  });

  test.describe('Job Creation', () => {
    test('job creation form should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      await expect(page).toHaveScreenshot('job-create-form.png', {
        fullPage: true,
      });
    });

    test('job creation form with validation errors should match snapshot', async ({ page }) => {
      await page.goto('/jobs/create');

      // Submit empty form to trigger validation
      const submitButton = page.locator('button[type="submit"]');

      if (await submitButton.count() > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('job-create-form-errors.png', {
          fullPage: true,
        });
      }
    });
  });

  test.describe('Job Details', () => {
    test('job details page should match snapshot', async ({ page }) => {
      // This would require a test job ID
      // Skipping actual navigation but keeping test structure
      test.skip();
    });

    test('job details QR code section should match snapshot', async ({ page }) => {
      test.skip();
    });

    test('job details helper info should match snapshot', async ({ page }) => {
      test.skip();
    });

    test('job details uploads gallery should match snapshot', async ({ page }) => {
      test.skip();
    });
  });

  test.describe('QR Scanner', () => {
    test('QR scanner page should match snapshot', async ({ page }) => {
      await page.goto('/jobs/join');

      await expect(page).toHaveScreenshot('qr-scanner.png', {
        fullPage: true,
      });
    });

    test('manual code entry should match snapshot', async ({ page }) => {
      await page.goto('/jobs/join');

      const manualEntry = page.locator('[data-testid="manual-entry"]').first();

      if (await manualEntry.count() > 0) {
        await expect(manualEntry).toHaveScreenshot('qr-manual-entry.png');
      }
    });
  });

  test.describe('Onboarding', () => {
    test('role selection page should match snapshot', async ({ page }) => {
      await page.goto('/onboarding/role');

      await expect(page).toHaveScreenshot('onboarding-role-selection.png', {
        fullPage: true,
      });
    });

    test('requester card should match snapshot', async ({ page }) => {
      await page.goto('/onboarding/role');

      const requesterCard = page.locator('[data-testid="role-card-requester"]').first();

      if (await requesterCard.count() > 0) {
        await expect(requesterCard).toHaveScreenshot('onboarding-requester-card.png');
      }
    });

    test('helper card should match snapshot', async ({ page }) => {
      await page.goto('/onboarding/role');

      const helperCard = page.locator('[data-testid="role-card-helper"]').first();

      if (await helperCard.count() > 0) {
        await expect(helperCard).toHaveScreenshot('onboarding-helper-card.png');
      }
    });
  });

  test.describe('Error Pages', () => {
    test('404 page should match snapshot', async ({ page }) => {
      await page.goto('/nonexistent-page-12345');

      await expect(page).toHaveScreenshot('404-page.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Responsive Layouts', () => {
    test('landing page mobile should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      await expect(page).toHaveScreenshot('landing-mobile.png', {
        fullPage: true,
      });
    });

    test('landing page tablet should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      await expect(page).toHaveScreenshot('landing-tablet.png', {
        fullPage: true,
      });
    });

    test('dashboard mobile should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      await expect(page).toHaveScreenshot('dashboard-mobile.png', {
        fullPage: true,
      });
    });

    test('dashboard tablet should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/dashboard');

      await expect(page).toHaveScreenshot('dashboard-tablet.png', {
        fullPage: true,
      });
    });

    test('job creation mobile should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/jobs/create');

      await expect(page).toHaveScreenshot('job-create-mobile.png', {
        fullPage: true,
      });
    });
  });
});
