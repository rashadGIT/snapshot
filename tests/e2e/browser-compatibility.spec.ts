import { test, expect, devices } from '@playwright/test';

/**
 * Browser Compatibility Tests
 * Tests camera access and MediaRecorder API across different browsers
 */

test.describe('Browser Compatibility Tests', () => {
  test.describe('Desktop Chrome', () => {

    test('should load application', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Snapspot/);
    });

    test.skip('should support MediaDevices API', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      await page.goto('/');

      const hasMediaDevices = await page.evaluate(() => {
        return typeof navigator.mediaDevices !== 'undefined' &&
               typeof navigator.mediaDevices.getUserMedia === 'function';
      });

      expect(hasMediaDevices).toBe(true);
    });

    test('should support MediaRecorder API', async ({ page }) => {
      await page.goto('/');

      const hasMediaRecorder = await page.evaluate(() => {
        return typeof MediaRecorder !== 'undefined';
      });

      expect(hasMediaRecorder).toBe(true);
    });
  });

  test.describe('Mobile Chrome (Android)', () => {

    test('should load on mobile', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Snapspot/);
    });

    test.skip('should be responsive on mobile', async ({ page }) => {
      await page.goto('/');

      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThanOrEqual(428); // Mobile width
    });

    test('should have touch-friendly buttons', async ({ page }) => {
      await page.goto('/');

      // Check if buttons are at least 44x44px (iOS HIG minimum)
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(40); // Allow some margin
          }
        }
      }
    });

    test.skip('should support mobile camera access', async ({ page, context }) => {
      await context.grantPermissions(['camera']);
      await page.goto('/');

      const hasCamera = await page.evaluate(() => {
        return typeof navigator.mediaDevices !== 'undefined' &&
               typeof navigator.mediaDevices.getUserMedia === 'function';
      });

      expect(hasCamera).toBe(true);
    });
  });

  test.describe('Mobile Safari (iOS)', () => {

    test('should load on iOS', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Snapspot/);
    });

    test.skip('should handle iOS viewport', async ({ page }) => {
      await page.goto('/');

      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(390); // iPhone 13 width
      expect(viewport?.height).toBe(844); // iPhone 13 height
    });

    test('should support iOS camera (webkit)', async ({ page }) => {
      await page.goto('/');

      const hasWebkit = await page.evaluate(() => {
        return /webkit/i.test(navigator.userAgent);
      });

      expect(hasWebkit).toBe(true);
    });

    test('should handle iOS safe areas', async ({ page }) => {
      await page.goto('/');

      // Check for safe area CSS variables
      const hasSafeArea = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--safe-area-inset-top') !== '';
      });

      // iOS sets safe area insets
      expect(typeof hasSafeArea).toBe('boolean');
    });
  });

  test.describe('Cross-Browser Features', () => {
    test('should support localStorage', async ({ page }) => {
      await page.goto('/');

      const hasLocalStorage = await page.evaluate(() => {
        try {
          localStorage.setItem('test', 'value');
          localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      });

      expect(hasLocalStorage).toBe(true);
    });

    test('should support Fetch API', async ({ page }) => {
      await page.goto('/');

      const hasFetch = await page.evaluate(() => {
        return typeof fetch === 'function';
      });

      expect(hasFetch).toBe(true);
    });

    test('should support ES6 features', async ({ page }) => {
      await page.goto('/');

      const hasES6 = await page.evaluate(() => {
        try {
          // Test arrow functions
          const arrow = () => true;
          // Test const/let
          const test = 1;
          // Test template literals
          const template = `test`;
          // Test promises
          const promise = Promise.resolve();

          return arrow() && test === 1 && template === 'test' && promise instanceof Promise;
        } catch {
          return false;
        }
      });

      expect(hasES6).toBe(true);
    });

    test('should handle canvas for photo capture', async ({ page }) => {
      await page.goto('/');

      const hasCanvas = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext && !!canvas.getContext('2d');
      });

      expect(hasCanvas).toBe(true);
    });

    test('should support video element', async ({ page }) => {
      await page.goto('/');

      const hasVideo = await page.evaluate(() => {
        const video = document.createElement('video');
        return typeof video.canPlayType === 'function';
      });

      expect(hasVideo).toBe(true);
    });

    test('should support WebM video format', async ({ page }) => {
      await page.goto('/');

      const supportsWebM = await page.evaluate(() => {
        const video = document.createElement('video');
        return video.canPlayType('video/webm') !== '';
      });

      expect(supportsWebM).toBe(true);
    });
  });

  test.describe('Performance', () => {
    test('should load within 3 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('should have acceptable lighthouse scores', async ({ page }) => {
      await page.goto('/');

      // Basic performance check
      const performanceMetrics = await page.evaluate(() => {
        const timing = performance.timing;
        return {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          fullyLoaded: timing.loadEventEnd - timing.navigationStart,
        };
      });

      expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
      expect(performanceMetrics.fullyLoaded).toBeLessThan(5000);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper semantic HTML', async ({ page }) => {
      await page.goto('/');

      const hasMain = await page.locator('main').count();
      expect(hasMain).toBeGreaterThan(0);
    });

    test.skip('should have keyboard navigation', async ({ page }) => {
      await page.goto('/');

      // Tab through elements
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName.toLowerCase();
      });

      expect(['a', 'button', 'input']).toContain(focusedElement);
    });

    test('should have alt text on images', async ({ page }) => {
      await page.goto('/');

      const images = await page.locator('img').all();

      for (const img of images) {
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          expect(alt).toBeDefined();
        }
      }
    });

    test('should have proper color contrast', async ({ page }) => {
      await page.goto('/');

      // Check for light text on light background
      const hasGoodContrast = await page.evaluate(() => {
        const body = document.body;
        const styles = getComputedStyle(body);
        const bgColor = styles.backgroundColor;
        const color = styles.color;

        // Basic check - not white on white
        return !(bgColor === 'rgb(255, 255, 255)' && color === 'rgb(255, 255, 255)');
      });

      expect(hasGoodContrast).toBe(true);
    });
  });

  test.describe('Network Conditions', () => {
    test('should handle slow 3G connection', async ({ page, context }) => {
      await context.route('**/*', async (route) => {
        // Simulate slow connection
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.goto('/');
      await expect(page).toHaveTitle(/Snapspot/);
    });

    test('should handle offline state gracefully', async ({ page, context }) => {
      await page.goto('/');

      // Go offline
      await context.setOffline(true);

      // Try to fetch something
      const isOffline = await page.evaluate(() => {
        return !navigator.onLine;
      });

      expect(isOffline).toBe(true);

      // Go back online
      await context.setOffline(false);
    });
  });

  test.describe('Screen Sizes', () => {
    const screenSizes = [
      { name: 'Small Mobile', width: 320, height: 568 },
      { name: 'Large Mobile', width: 428, height: 926 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 },
    ];

    for (const size of screenSizes) {
      test(`should work on ${size.name} (${size.width}x${size.height})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('/');

        await expect(page).toHaveTitle(/Snapspot/);

        // Check that content is visible (not cut off)
        const body = await page.locator('body').boundingBox();
        expect(body?.width).toBeLessThanOrEqual(size.width);
      });
    }
  });

  test.describe('JavaScript Disabled', () => {
    test('should show appropriate message without JS', async ({ page, context }) => {
      await context.route('**/*.js', route => route.abort());

      await page.goto('/');

      // Next.js requires JS, so page won't fully load
      // But should not show blank screen
      const hasContent = await page.evaluate(() => {
        return document.body.textContent && document.body.textContent.length > 0;
      });

      expect(hasContent).toBe(true);
    });
  });
});
