import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests for Complete Job Lifecycle
 * Tests the full flow from job creation to completion
 */

test.describe('Job Lifecycle E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let jobId: string;

  test('should load landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Snapspot/);
  });

  test('should navigate to sign in', async ({ page }) => {
    await page.goto('/');
    const signInButton = page.locator('button:has-text("Sign In")').first();
    if (await signInButton.isVisible()) {
      // Landing page shown - not authenticated
      await expect(page.locator('h1')).toContainText(/Snapspot|Capture/i);
    }
  });

  test.skip('Requester: should create a new job', async ({ page }) => {
    // Skip auth-required tests in CI unless we set up test auth
    await page.goto('/dashboard');

    await page.click('button:has-text("Create Job")');

    await page.fill('input[name="title"]', 'E2E Test Job');
    await page.fill('textarea[name="description"]', 'Capture photos for E2E testing');
    await page.fill('input[name="location"]', 'Test Location');
    await page.fill('input[type="datetime-local"]', '2025-12-31T18:00');
    await page.selectOption('select[name="priceTier"]', 'standard');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/jobs\/.+/);

    // Extract job ID from URL
    const url = page.url();
    jobId = url.split('/jobs/')[1];
    expect(jobId).toBeTruthy();
  });

  test.skip('Requester: should see job details page', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await expect(page.locator('h1')).toContainText('E2E Test Job');
    await expect(page.locator('text=OPEN')).toBeVisible();
  });

  test.skip('Requester: should generate QR code', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await page.click('button:has-text("Generate QR Code")');

    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();
    await expect(page.locator('text=/[0-9]{6}/')).toBeVisible(); // Backup code
  });

  test.skip('Helper: should join job via backup code', async ({ context, page }) => {
    // Create new context for Helper
    const helperPage = await context.newPage();
    await helperPage.goto('/dashboard');

    // Switch to Helper role
    await helperPage.click('button:has-text("Helper")');

    // Join job
    await helperPage.click('button:has-text("Join Job")');
    await helperPage.fill('input[name="code"]', '123456'); // Mock code
    await helperPage.click('button[type="submit"]');

    await expect(helperPage).toHaveURL(/\/jobs\/.+/);
  });

  test.skip('Helper: should upload photo', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    // Open camera
    await page.click('button:has-text("Open Camera")');

    // Grant camera permissions (mocked in test environment)
    await page.evaluate(() => {
      // Mock MediaDevices
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        return canvas.captureStream() as any;
      };
    });

    // Capture photo
    await page.click('button:has-text("Capture Photo")');

    await expect(page.locator('text=/Photo uploaded successfully/')).toBeVisible();
  });

  test.skip('Helper: should submit job for review', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await page.click('button:has-text("Submit for Review")');
    await page.click('button:has-text("OK")'); // Confirm dialog

    await expect(page.locator('text=IN_REVIEW')).toBeVisible();
  });

  test.skip('Requester: should see submitted content', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await expect(page.locator('text=/Review Deadline|Ready to Review/')).toBeVisible();
    await expect(page.locator('button:has-text("Approve Job")')).toBeVisible();
    await expect(page.locator('text=/Uploaded Content/')).toBeVisible();
  });

  test.skip('Requester: should approve job', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await page.click('button:has-text("Approve Job")');
    await page.click('button:has-text("OK")'); // Confirm dialog

    await expect(page.locator('text=COMPLETED')).toBeVisible();
    await expect(page.locator('text=/Job approved/')).toBeVisible();
  });

  test.skip('Helper: should lose access after approval', async ({ page }) => {
    await page.goto(`/jobs/${jobId}`);

    await expect(page.locator('text=/Job Approved & Completed/')).toBeVisible();
    await expect(page.locator('text=/Capture Content/')).not.toBeVisible();
  });
});

test.describe.skip('Mobile Responsiveness', () => {

  test('should be mobile responsive', async ({ page }) => {
    await page.goto('/');

    // Check mobile menu
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
  });
});
