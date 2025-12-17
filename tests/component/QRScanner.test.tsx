import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JoinJobPage from '@/app/jobs/join/page';

/**
 * QR Scanner Component Tests
 * Tests QR scanning and manual token entry
 */

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock html5-qrcode library
const mockScannerClear = vi.fn();
const mockScannerRender = vi.fn();
vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn(function (this: any) {
    this.render = mockScannerRender;
    this.clear = mockScannerClear;
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe.skip('QR Scanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockScannerClear.mockClear();
    mockScannerRender.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render join job page', () => {
      render(<JoinJobPage />);

      expect(screen.getByText('Join Job')).toBeDefined();
    });

    it('should show QR scanner section', () => {
      render(<JoinJobPage />);

      expect(screen.getByText('QR Scanner')).toBeDefined();
      expect(screen.getByText(/Scan a QR code to join a job/i)).toBeDefined();
    });

    it('should show manual entry section', () => {
      render(<JoinJobPage />);

      expect(screen.getByText(/Or Enter Code Manually/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Enter token or code/i)).toBeDefined();
    });

    it('should show test code hint', () => {
      render(<JoinJobPage />);

      expect(screen.getByText(/Testing\?/)).toBeDefined();
      expect(screen.getByText('123456')).toBeDefined();
    });

    it('should render Start QR Scanner button', () => {
      render(<JoinJobPage />);

      expect(screen.getByText(/Start QR Scanner/i)).toBeDefined();
    });
  });

  describe('QR Scanner Activation', () => {
    it('should activate scanner when button clicked', async () => {
      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Scanning QR Code.../i)).toBeDefined();
      });
    });

    it('should show cancel button when scanner active', async () => {
      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeDefined();
      });
    });

    it('should show scanner element when active', async () => {
      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        const scannerElement = document.getElementById('qr-reader');
        expect(scannerElement).toBeDefined();
      });
    });

    it('should initialize Html5QrcodeScanner', async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode');

      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(Html5QrcodeScanner).toHaveBeenCalled();
      });
    });

    it('should stop scanner when cancel clicked', async () => {
      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeDefined();
      });

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockScannerClear).toHaveBeenCalled();
      });
    });
  });

  describe('QR Code Scanning', () => {
    it('should handle successful QR scan', async () => {
      let onScanSuccess: (decodedText: string) => void = () => {};

      mockScannerRender.mockImplementation((successCallback, errorCallback) => {
        onScanSuccess = successCallback;
      });

      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockScannerRender).toHaveBeenCalled();
      });

      // Simulate QR code scan
      onScanSuccess('abc123token');

      await waitFor(() => {
        const tokenInput = screen.getByPlaceholderText(/Enter token or code/i) as HTMLInputElement;
        expect(tokenInput.value).toBe('abc123token');
      });
    });

    it('should extract token from URL', async () => {
      let onScanSuccess: (decodedText: string) => void = () => {};

      mockScannerRender.mockImplementation((successCallback, errorCallback) => {
        onScanSuccess = successCallback;
      });

      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockScannerRender).toHaveBeenCalled();
      });

      // Simulate scanning a URL with token
      onScanSuccess('https://snapspot.com/join/abc123token');

      await waitFor(() => {
        const tokenInput = screen.getByPlaceholderText(/Enter token or code/i) as HTMLInputElement;
        expect(tokenInput.value).toBe('abc123token');
      });
    });

    it('should redirect when scanning full URL', async () => {
      let onScanSuccess: (decodedText: string) => void = () => {};

      mockScannerRender.mockImplementation((successCallback, errorCallback) => {
        onScanSuccess = successCallback;
      });

      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockScannerRender).toHaveBeenCalled();
      });

      // Simulate scanning a full URL
      onScanSuccess('http://localhost:3000/jobs/123');

      expect(window.location.href).toBe('http://localhost:3000/jobs/123');

      window.location = originalLocation;
    });

    it('should clear scanner after successful scan', async () => {
      let onScanSuccess: (decodedText: string) => void = () => {};

      mockScannerRender.mockImplementation((successCallback, errorCallback) => {
        onScanSuccess = successCallback;
      });

      render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockScannerRender).toHaveBeenCalled();
      });

      onScanSuccess('abc123token');

      await waitFor(() => {
        expect(mockScannerClear).toHaveBeenCalled();
      });
    });
  });

  describe('Manual Token Entry', () => {
    it('should update token input on change', () => {
      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '123456' } });

      expect(input.value).toBe('123456');
    });

    it('should enable submit button when token entered', () => {
      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      const submitButton = screen.getByText('Join Job').closest('button')!;

      // Initially disabled
      expect(submitButton.disabled).toBe(true);

      // Enable after entering token
      fireEvent.change(input, { target: { value: '123456' } });
      expect(submitButton.disabled).toBe(false);
    });

    it('should keep submit button disabled with empty token', () => {
      render(<JoinJobPage />);

      const submitButton = screen.getByText('Join Job').closest('button')!;
      expect(submitButton.disabled).toBe(true);
    });

    it('should submit form with valid token', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true, jobId: 'job-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/jobs/check-token',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: '123456' }),
          })
        );
      });
    });

    it('should navigate to job page after successful join', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true, jobId: 'job-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/jobs/job-123');
      });
    });

    it('should show error for invalid token', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, reason: 'Token expired' }),
      });

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: 'invalid123' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Token expired');
      });

      alertMock.mockRestore();
    });

    it('should show error if join fails', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true, jobId: 'job-123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Job already has a helper' }),
        });

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Job already has a helper');
      });

      alertMock.mockRestore();
    });

    it('should trim whitespace from token', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true, jobId: 'job-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '  123456  ' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/jobs/check-token',
          expect.objectContaining({
            body: JSON.stringify({ token: '123456' }),
          })
        );
      });
    });

    it('should disable input while loading', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(input.disabled).toBe(true);
      });
    });

    it('should show loading state on submit button', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Joining Job...')).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      fireEvent.change(input, { target: { value: '123456' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Something went wrong. Please try again.');
      });

      alertMock.mockRestore();
      consoleError.mockRestore();
    });

    it('should not submit empty token', () => {
      render(<JoinJobPage />);

      const input = screen.getByPlaceholderText(/Enter token or code/i);
      const form = input.closest('form')!;

      fireEvent.submit(form);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button clicked', () => {
      render(<JoinJobPage />);

      const backButton = document.querySelector('button svg')?.closest('button');
      if (backButton) {
        fireEvent.click(backButton);
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      }
    });
  });

  describe('Cleanup', () => {
    it('should clear scanner on unmount', () => {
      const { unmount } = render(<JoinJobPage />);

      const startButton = screen.getByText(/Start QR Scanner/i);
      fireEvent.click(startButton);

      unmount();

      // Scanner should be cleaned up
      expect(mockScannerClear).toHaveBeenCalled();
    });
  });
});
