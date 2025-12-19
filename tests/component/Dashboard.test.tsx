import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

/**
 * Dashboard Component Tests
 * Tests role switching, job listing, and navigation
 */

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Loading State', () => {
    it.skip('should show loading spinner initially', () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise(() => {}) // Never resolves
      );

      render(<DashboardPage />);
      expect(screen.getByText(/loading/i) || document.querySelector('.spinner')).toBeDefined();
    });
  });

  describe('User Authentication', () => {
    it('should redirect to home if not authenticated', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should load user data on mount', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeDefined();
      });
    });
  });

  describe('Role Switching', () => {
    it('should display role switcher when user has both roles', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Requester')).toBeDefined();
        expect(screen.getByText('Helper')).toBeDefined();
      });
    });

    it('should highlight active role', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        const requesterButton = screen.getByText('Requester').closest('button');
        expect(requesterButton?.className).toContain('bg-white');
      });
    });

    it('should switch role when clicked', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'HELPER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Helper')).toBeDefined();
      });

      const helperButton = screen.getByText('Helper').closest('button');
      fireEvent.click(helperButton!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/me',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ activeRole: 'HELPER' }),
          })
        );
      });
    });

    it('should show "Become Helper" button when user only has REQUESTER role', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Become Helper/i)).toBeDefined();
      });
    });

    it('should add new role when "Become" button clicked', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Become Helper/i)).toBeDefined();
      });

      const becomeButton = screen.getByText(/Become Helper/i);
      fireEvent.click(becomeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/me',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ role: 'HELPER' }),
          })
        );
      });

      alertMock.mockRestore();
    });
  });

  describe('Job Listing - Requester View', () => {
    it('should display "My Jobs" heading for requester', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('My Jobs')).toBeDefined();
      });
    });

    it('should show "Create Job" button for requester', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Create Job')).toBeDefined();
      });
    });

    it('should navigate to /jobs/create when Create Job clicked', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Create Job')).toBeDefined();
      });

      const createButton = screen.getByText('+ Create Job');
      fireEvent.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/jobs/create');
    });

    it('should display list of jobs', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobs: [
              {
                id: 'job-1',
                title: 'Wedding Photography',
                location: 'Central Park',
                eventTime: '2024-12-25T10:00:00Z',
                status: 'OPEN',
                contentType: 'photos',
                priceTier: 'standard',
              },
              {
                id: 'job-2',
                title: 'Birthday Party',
                location: 'Brooklyn',
                eventTime: '2024-12-26T14:00:00Z',
                status: 'ACCEPTED',
                contentType: 'videos',
                priceTier: 'premium',
              },
            ],
          }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Wedding Photography')).toBeDefined();
        expect(screen.getByText('Birthday Party')).toBeDefined();
        expect(screen.getByText('Central Park')).toBeDefined();
        expect(screen.getByText('Brooklyn')).toBeDefined();
      });
    });

    it('should navigate to job details when job card clicked', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobs: [
              {
                id: 'job-1',
                title: 'Wedding Photography',
                location: 'Central Park',
                eventTime: '2024-12-25T10:00:00Z',
                status: 'OPEN',
                contentType: 'photos',
                priceTier: 'standard',
              },
            ],
          }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Wedding Photography')).toBeDefined();
      });

      const jobCard = screen.getByText('Wedding Photography').closest('.card');
      fireEvent.click(jobCard!);

      expect(mockPush).toHaveBeenCalledWith('/jobs/job-1');
    });

    it('should show empty state when no jobs', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('No jobs yet')).toBeDefined();
      });
    });
  });

  describe('Job Listing - Helper View', () => {
    it('should display "Available Jobs" heading for helper', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['HELPER'],
              activeRole: 'HELPER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Available Jobs')).toBeDefined();
      });
    });

    it('should show "Scan QR Code" button for helper', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['HELPER'],
              activeRole: 'HELPER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeDefined();
      });
    });

    it('should navigate to /jobs/join when Scan QR clicked', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['HELPER'],
              activeRole: 'HELPER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeDefined();
      });

      const scanButton = screen.getByText('Scan QR Code');
      fireEvent.click(scanButton);

      expect(mockPush).toHaveBeenCalledWith('/jobs/join');
    });
  });

  describe('Logout', () => {
    it('should redirect to /api/auth/logout when Sign Out clicked', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Sign Out').length).toBeGreaterThan(0);
      });

      // There are two Sign Out buttons (mobile and desktop), click the first one
      const signOutButtons = screen.getAllByText('Sign Out');
      fireEvent.click(signOutButtons[0]);

      expect(window.location.href).toBe('/api/auth/logout');

      window.location = originalLocation;
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('should show alert when role switch fails', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              roles: ['REQUESTER', 'HELPER'],
              activeRole: 'REQUESTER',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobs: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Helper')).toBeDefined();
      });

      const helperButton = screen.getByText('Helper').closest('button');
      fireEvent.click(helperButton!);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to switch role');
      });

      alertMock.mockRestore();
    });
  });
});
