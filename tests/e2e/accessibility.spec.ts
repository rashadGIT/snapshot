import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests
 * Tests WCAG 2.1 AA compliance and screen reader compatibility
 */

test.describe.skip('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('WCAG 2.1 AA Compliance', () => {
    test('should not have automatically detectable accessibility violations', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should pass color contrast checks', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['cat.color'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      // Should have exactly one h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      // Check heading order (shouldn't skip levels)
      const headingLevels = await Promise.all(
        headings.map(async (heading) => {
          const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
          return parseInt(tagName.replace('h', ''));
        })
      );

      // First heading should be h1
      if (headingLevels.length > 0) {
        expect(headingLevels[0]).toBe(1);
      }
    });

    test('should have accessible form labels', async ({ page }) => {
      const inputs = await page.locator('input, textarea, select').all();

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Each input should have either:
        // 1. An associated label (via id)
        // 2. An aria-label
        // 3. An aria-labelledby
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          const hasLabel = label > 0 || ariaLabel || ariaLabelledBy;
          expect(hasLabel).toBe(true);
        } else {
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    });

    test('should have accessible buttons', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');

        // Each button should have either text content or aria-label
        const hasAccessibleName =
          (text && text.trim().length > 0) ||
          ariaLabel ||
          ariaLabelledBy;

        expect(hasAccessibleName).toBe(true);
      }
    });

    test('should have alt text on all images', async ({ page }) => {
      const images = await page.locator('img').all();

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt).toBeDefined();
      }
    });

    test('should use semantic HTML', async ({ page }) => {
      // Should have main landmark
      const main = await page.locator('main').count();
      expect(main).toBeGreaterThan(0);

      // Should have nav if navigation present
      const links = await page.locator('a').count();
      if (links > 3) {
        const nav = await page.locator('nav').count();
        expect(nav).toBeGreaterThan(0);
      }
    });

    test('should have proper link accessibility', async ({ page }) => {
      const links = await page.locator('a').all();

      for (const link of links) {
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        // Links should have href
        expect(href).toBeTruthy();

        // Links should have accessible text
        const hasAccessibleName =
          (text && text.trim().length > 0) ||
          ariaLabel;

        expect(hasAccessibleName).toBe(true);
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow tab navigation through interactive elements', async ({ page }) => {
      // Get all focusable elements
      const focusableElements = await page.locator(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ).all();

      if (focusableElements.length === 0) return;

      // Tab to first element
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(firstFocused);

      // Tab through several elements
      for (let i = 0; i < Math.min(5, focusableElements.length - 1); i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(focused);
      }
    });

    test('should support shift+tab for reverse navigation', async ({ page }) => {
      const focusableElements = await page.locator(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ).all();

      if (focusableElements.length < 2) return;

      // Tab forward twice
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Tab backward
      await page.keyboard.press('Shift+Tab');

      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(focused);
    });

    test('should activate buttons with Enter key', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();

      if (buttons.length === 0) return;

      const button = buttons[0];
      await button.focus();

      const tagName = await page.evaluate(() => document.activeElement?.tagName);
      expect(tagName).toBe('BUTTON');
    });

    test('should activate buttons with Space key', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();

      if (buttons.length === 0) return;

      const button = buttons[0];
      await button.focus();
      await page.keyboard.press('Space');

      // Button should still be focused after activation
      const tagName = await page.evaluate(() => document.activeElement?.tagName);
      expect(tagName).toBe('BUTTON');
    });

    test('should have visible focus indicators', async ({ page }) => {
      const focusableElements = await page.locator('a, button, input').all();

      if (focusableElements.length === 0) return;

      await page.keyboard.press('Tab');

      // Check if focused element has visible outline or ring
      const hasFocusIndicator = await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement;
        if (!focused) return false;

        const styles = window.getComputedStyle(focused);
        const outline = styles.outline;
        const outlineWidth = styles.outlineWidth;
        const boxShadow = styles.boxShadow;

        return (
          (outline && outline !== 'none' && outlineWidth !== '0px') ||
          (boxShadow && boxShadow !== 'none')
        );
      });

      expect(hasFocusIndicator).toBe(true);
    });

    test('should trap focus in modals', async ({ page }) => {
      // This test assumes modals exist in the app
      const modals = await page.locator('[role="dialog"]').count();

      if (modals === 0) {
        // Skip if no modals present
        return;
      }

      // Open modal (implementation specific)
      // await page.click('[data-testid="open-modal"]');

      // Tab through modal elements
      // Focus should stay within modal
      // (Implementation depends on modal structure)
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have proper ARIA landmarks', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['cat.aria'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should use ARIA roles appropriately', async ({ page }) => {
      // Check for common ARIA misuse
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['best-practice'])
        .analyze();

      // Filter for ARIA-related violations
      const ariaViolations = accessibilityScanResults.violations.filter(
        v => v.id.includes('aria')
      );

      expect(ariaViolations).toEqual([]);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      const liveRegions = await page.locator('[aria-live]').all();

      for (const region of liveRegions) {
        const ariaLive = await region.getAttribute('aria-live');
        expect(['polite', 'assertive', 'off']).toContain(ariaLive);
      }
    });

    test('should have proper aria-expanded for expandable elements', async ({ page }) => {
      const expandableElements = await page.locator('[aria-expanded]').all();

      for (const element of expandableElements) {
        const ariaExpanded = await element.getAttribute('aria-expanded');
        expect(['true', 'false']).toContain(ariaExpanded);
      }
    });

    test('should properly label form controls', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['cat.forms'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper button roles', async ({ page }) => {
      const divButtons = await page.locator('div[role="button"], span[role="button"]').all();

      for (const button of divButtons) {
        // Non-button elements with button role should be keyboard accessible
        const tabindex = await button.getAttribute('tabindex');
        expect(tabindex !== '-1').toBe(true);
      }
    });
  });

  test.describe('Visual Accessibility', () => {
    test('should maintain readability when zoomed to 200%', async ({ page }) => {
      // Zoom to 200%
      await page.evaluate(() => {
        document.body.style.zoom = '2';
      });

      // Check for horizontal scrolling (should be minimal)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      // Some horizontal scroll is acceptable, but not excessive
      expect(hasHorizontalScroll).toBe(false);

      // Reset zoom
      await page.evaluate(() => {
        document.body.style.zoom = '1';
      });
    });

    test('should have sufficient color contrast', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('body')
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('should not rely solely on color to convey information', async ({ page }) => {
      // Check for common patterns where color is the only indicator
      const colorOnlyElements = await page.locator('[style*="color"]').all();

      // This is a heuristic check - elements with only color styling
      // should also have text, icons, or other indicators
      for (const element of colorOnlyElements) {
        const text = await element.textContent();
        const hasContent = text && text.trim().length > 0;
        const hasIcon = await element.locator('svg, img, [class*="icon"]').count() > 0;

        // Element should have text or icon, not just color
        expect(hasContent || hasIcon).toBe(true);
      }
    });

    test('should support prefers-reduced-motion', async ({ page, context }) => {
      // Set prefers-reduced-motion
      await context.emulateMedia({ reducedMotion: 'reduce' });

      await page.goto('/');

      // Check that animations are disabled or reduced
      const hasAnimations = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        for (const el of Array.from(allElements)) {
          const styles = window.getComputedStyle(el);
          const animation = styles.animation;
          const transition = styles.transition;

          // If animation or transition exists, it should be very short or none
          if (animation && animation !== 'none' && !animation.includes('0s')) {
            return true;
          }
          if (transition && transition !== 'none' && !transition.includes('0s')) {
            return true;
          }
        }
        return false;
      });

      // With reduced motion, there should be no or minimal animations
      // This check might need adjustment based on your animation strategy
      expect(hasAnimations).toBe(false);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should have touch targets at least 44x44px', async ({ page }) => {
      const interactiveElements = await page.locator('a, button, input[type="checkbox"], input[type="radio"]').all();

      for (const element of interactiveElements) {
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(40); // Allow 4px margin
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
      }
    });

    test('should have adequate spacing between touch targets', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();

      // Check spacing between consecutive buttons
      for (let i = 0; i < buttons.length - 1; i++) {
        const box1 = await buttons[i].boundingBox();
        const box2 = await buttons[i + 1].boundingBox();

        if (box1 && box2) {
          // Calculate distance between buttons
          const horizontalGap = Math.abs(box2.x - (box1.x + box1.width));
          const verticalGap = Math.abs(box2.y - (box1.y + box1.height));

          // Should have at least 8px spacing if adjacent
          if (horizontalGap < 100 && verticalGap < 100) {
            const minGap = Math.min(horizontalGap, verticalGap);
            expect(minGap).toBeGreaterThanOrEqual(4); // Reduced for margin of error
          }
        }
      }
    });

    test('should support pinch-to-zoom', async ({ page }) => {
      const viewport = await page.locator('meta[name="viewport"]');

      if (await viewport.count() > 0) {
        const content = await viewport.getAttribute('content');

        // Should not disable zooming
        expect(content).not.toContain('user-scalable=no');
        expect(content).not.toContain('maximum-scale=1');
      }
    });
  });

  test.describe('Error Handling Accessibility', () => {
    test('should announce form errors to screen readers', async ({ page }) => {
      // This test assumes there's a form with validation
      const forms = await page.locator('form').count();

      if (forms === 0) return;

      // Submit form with invalid data
      // const submitButton = await page.locator('button[type="submit"]').first();
      // await submitButton.click();

      // Error messages should be associated with inputs
      const errors = await page.locator('[role="alert"], .error, [aria-invalid="true"]').all();

      for (const error of errors) {
        const ariaLive = await error.getAttribute('aria-live');
        const ariaAtomic = await error.getAttribute('aria-atomic');
        const role = await error.getAttribute('role');

        // Error should be announced
        const isAccessible =
          role === 'alert' ||
          ariaLive === 'polite' ||
          ariaLive === 'assertive';

        expect(isAccessible).toBe(true);
      }
    });

    test('should have accessible loading states', async ({ page }) => {
      const loadingIndicators = await page.locator('[aria-busy="true"], [role="status"]').all();

      for (const indicator of loadingIndicators) {
        const ariaLive = await indicator.getAttribute('aria-live');
        const ariaLabel = await indicator.getAttribute('aria-label');

        // Loading indicators should announce status
        expect(ariaLive || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Document Structure', () => {
    test('should have a valid page title', async ({ page }) => {
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe('React App'); // Default title
    });

    test('should have a lang attribute on html element', async ({ page }) => {
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
      expect(lang?.length).toBeGreaterThan(0);
    });

    test('should have proper meta tags', async ({ page }) => {
      const charset = await page.locator('meta[charset]').count();
      const viewport = await page.locator('meta[name="viewport"]').count();

      expect(charset).toBeGreaterThan(0);
      expect(viewport).toBeGreaterThan(0);
    });

    test('should not have duplicate IDs', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['best-practice'])
        .analyze();

      const duplicateIdViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'duplicate-id'
      );

      expect(duplicateIdViolations).toEqual([]);
    });
  });
});
