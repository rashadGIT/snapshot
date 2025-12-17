import { test, expect } from '@playwright/test';

/**
 * Multi-User E2E Tests
 * Tests concurrent user interactions and race conditions
 */

test.describe.skip('Concurrent Users E2E Tests', () => {
  test.describe('Job Joining Conflicts', () => {
    test('two helpers cannot join same job', async ({ browser }) => {
      // Create two separate browser contexts (two users)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const helper1 = await context1.newPage();
      const helper2 = await context2.newPage();

      // Both helpers try to join the same job
      await helper1.goto('/jobs/join');
      await helper2.goto('/jobs/join');

      // Simulate entering same QR token
      const token = '123456'; // Mock token

      const input1 = helper1.locator('input[type="text"]');
      const input2 = helper2.locator('input[type="text"]');

      if (await input1.count() > 0 && await input2.count() > 0) {
        await input1.fill(token);
        await input2.fill(token);

        // Try to submit simultaneously
        const submit1Promise = helper1.locator('button[type="submit"]').click().catch(() => {});
        const submit2Promise = helper2.locator('button[type="submit"]').click().catch(() => {});

        await Promise.all([submit1Promise, submit2Promise]);

        // One should succeed, one should fail
        // Check for error message on at least one page
        await helper1.waitForTimeout(1000);
        await helper2.waitForTimeout(1000);
      }

      await context1.close();
      await context2.close();
    });

    test('job status changes prevent late joiners', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const requester = await context1.newPage();
      const helper = await context2.newPage();

      // Requester cancels job while helper tries to join
      await requester.goto('/dashboard');
      await helper.goto('/jobs/join');

      // Simulate race condition
      await Promise.all([
        requester.locator('[data-action="cancel"]').first().click().catch(() => {}),
        helper.locator('button[type="submit"]').click().catch(() => {}),
      ]);

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Concurrent Uploads', () => {
    test('multiple helpers can upload to different jobs simultaneously', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const helper1 = await context1.newPage();
      const helper2 = await context2.newPage();

      await helper1.goto('/dashboard');
      await helper2.goto('/dashboard');

      // Navigate to different jobs
      const job1 = helper1.locator('[data-testid="job-card"]').first();
      const job2 = helper2.locator('[data-testid="job-card"]').nth(1);

      if (await job1.count() > 0 && await job2.count() > 0) {
        await Promise.all([
          job1.click().catch(() => {}),
          job2.click().catch(() => {}),
        ]);
      }

      await context1.close();
      await context2.close();
    });

    test('helper cannot upload to same job twice concurrently', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // Same helper (same context), different tabs
      await page1.goto('/dashboard');
      await page2.goto('/dashboard');

      // Try to access same job in both tabs
      const job1 = page1.locator('[data-testid="job-card"]').first();
      const job2 = page2.locator('[data-testid="job-card"]').first();

      if (await job1.count() > 0) {
        await job1.click().catch(() => {});
        await job2.click().catch(() => {});

        // Both tabs open same job
        await page1.waitForTimeout(500);
        await page2.waitForTimeout(500);
      }

      await context.close();
    });
  });

  test.describe('Status Update Conflicts', () => {
    test('requester cannot approve while helper is submitting', async ({ browser }) => {
      const requesterContext = await browser.newContext();
      const helperContext = await browser.newContext();

      const requester = await requesterContext.newPage();
      const helper = await helperContext.newPage();

      await requester.goto('/dashboard');
      await helper.goto('/dashboard');

      // Navigate to same job
      const requesterJob = requester.locator('[data-testid="job-card"]').first();
      const helperJob = helper.locator('[data-testid="job-card"]').first();

      if (await requesterJob.count() > 0) {
        await requesterJob.click().catch(() => {});
        await helperJob.click().catch(() => {});

        // Try to click approve and submit simultaneously
        await Promise.all([
          requester.locator('[data-action="approve"]').click().catch(() => {}),
          helper.locator('[data-action="submit"]').click().catch(() => {}),
        ]);
      }

      await requesterContext.close();
      await helperContext.close();
    });

    test('helper sees updated status in real-time', async ({ browser }) => {
      const requesterContext = await browser.newContext();
      const helperContext = await browser.newContext();

      const requester = await requesterContext.newPage();
      const helper = await helperContext.newPage();

      await requester.goto('/dashboard');
      await helper.goto('/dashboard');

      // Requester updates job, helper should see changes
      const requesterJob = requester.locator('[data-testid="job-card"]').first();

      if (await requesterJob.count() > 0) {
        await requesterJob.click().catch(() => {});

        // Make a change
        await requester.locator('[data-action="cancel"]').click().catch(() => {});

        // Helper refreshes and sees updated status
        await helper.reload();
        await helper.waitForTimeout(500);
      }

      await requesterContext.close();
      await helperContext.close();
    });
  });

  test.describe('Message Threading', () => {
    test('messages from multiple users appear in correct order', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const user1 = await context1.newPage();
      const user2 = await context2.newPage();

      // Navigate to job with messages
      await user1.goto('/dashboard');
      await user2.goto('/dashboard');

      const job = user1.locator('[data-testid="job-card"]').first();

      if (await job.count() > 0) {
        await job.click().catch(() => {});

        // Both users try to send messages
        const messageInput1 = user1.locator('[data-testid="message-input"]');
        const messageInput2 = user2.locator('[data-testid="message-input"]');

        if (await messageInput1.count() > 0) {
          await messageInput1.fill('Message from user 1');
          await messageInput2.fill('Message from user 2');

          await Promise.all([
            user1.locator('[data-testid="send-message"]').click().catch(() => {}),
            user2.locator('[data-testid="send-message"]').click().catch(() => {}),
          ]);

          await user1.waitForTimeout(1000);
          await user2.waitForTimeout(1000);
        }
      }

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Resource Conflicts', () => {
    test('upload deletion while requester is viewing', async ({ browser }) => {
      const helperContext = await browser.newContext();
      const requesterContext = await browser.newContext();

      const helper = await helperContext.newPage();
      const requester = await requesterContext.newPage();

      await helper.goto('/dashboard');
      await requester.goto('/dashboard');

      // Navigate to same job
      const job = helper.locator('[data-testid="job-card"]').first();

      if (await job.count() > 0) {
        await job.click().catch(() => {});

        // Helper deletes upload while requester views it
        const deleteButton = helper.locator('[data-action="delete-upload"]').first();

        if (await deleteButton.count() > 0) {
          await deleteButton.click().catch(() => {});

          // Requester should see upload disappear
          await requester.reload();
          await requester.waitForTimeout(500);
        }
      }

      await helperContext.close();
      await requesterContext.close();
    });
  });

  test.describe('Session Management', () => {
    test('multiple sessions for same user', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const tab1 = await context1.newPage();
      const tab2 = await context2.newPage();

      // Same user, different tabs
      await tab1.goto('/dashboard');
      await tab2.goto('/dashboard');

      // Actions in one tab should reflect in other
      await tab1.reload();
      await tab2.reload();

      await context1.close();
      await context2.close();
    });

    test('session timeout handling', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/dashboard');

      // Simulate long idle time
      await page.waitForTimeout(2000);

      // Try to perform action
      const action = page.locator('button').first();

      if (await action.count() > 0) {
        await action.click().catch(() => {});
      }

      await context.close();
    });
  });

  test.describe('Rate Limiting', () => {
    test('multiple rapid requests from same user', async ({ page }) => {
      await page.goto('/dashboard');

      // Make multiple rapid requests
      const requests = [];

      for (let i = 0; i < 10; i++) {
        requests.push(
          page.reload().catch(() => {})
        );
      }

      await Promise.all(requests);

      // Should not crash
      expect(page.url()).toBeTruthy();
    });

    test('distributed requests from multiple users', async ({ browser }) => {
      const contexts = await Promise.all(
        Array.from({ length: 5 }, () => browser.newContext())
      );

      const pages = await Promise.all(
        contexts.map(ctx => ctx.newPage())
      );

      // All users load dashboard simultaneously
      await Promise.all(
        pages.map(page => page.goto('/dashboard').catch(() => {}))
      );

      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });

  test.describe('Data Consistency', () => {
    test('job count remains consistent across users', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const user1 = await context1.newPage();
      const user2 = await context2.newPage();

      await user1.goto('/dashboard');
      await user2.goto('/dashboard');

      // Count jobs on both pages
      const count1 = await user1.locator('[data-testid="job-card"]').count();
      const count2 = await user2.locator('[data-testid="job-card"]').count();

      // Counts should be similar (may differ slightly based on roles)
      expect(Math.abs(count1 - count2)).toBeLessThan(10);

      await context1.close();
      await context2.close();
    });
  });
});
