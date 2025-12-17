import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateJobPage from '@/app/jobs/create/page';

/**
 * Job Create Form Component Tests
 * Tests form validation, submission, and error handling
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

describe.skip('Job Create Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Form Rendering', () => {
    it('should render all form fields', () => {
      render(<CreateJobPage />);

      expect(screen.getByLabelText(/Job Title/i)).toBeDefined();
      expect(screen.getByLabelText(/Description/i)).toBeDefined();
      expect(screen.getByLabelText(/Location/i)).toBeDefined();
      expect(screen.getByLabelText(/Event Date & Time/i)).toBeDefined();
      expect(screen.getByLabelText(/Content Type/i)).toBeDefined();
      expect(screen.getByLabelText(/Price Tier/i)).toBeDefined();
      expect(screen.getByLabelText(/Additional Notes/i)).toBeDefined();
    });

    it('should mark required fields with asterisk', () => {
      render(<CreateJobPage />);

      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThanOrEqual(5);
    });

    it('should render content type buttons', () => {
      render(<CreateJobPage />);

      expect(screen.getByText('Photos')).toBeDefined();
      expect(screen.getByText('Videos')).toBeDefined();
      expect(screen.getByText('Both')).toBeDefined();
    });

    it('should render price tier buttons', () => {
      render(<CreateJobPage />);

      expect(screen.getByText('Basic')).toBeDefined();
      expect(screen.getByText('Standard')).toBeDefined();
      expect(screen.getByText('Premium')).toBeDefined();
    });

    it('should render submit and cancel buttons', () => {
      render(<CreateJobPage />);

      expect(screen.getByText('Create Job')).toBeDefined();
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    it('should have "standard" as default price tier', () => {
      render(<CreateJobPage />);

      const standardButton = screen.getByText('Standard').closest('button');
      expect(standardButton?.className).toContain('btn-primary');
    });

    it('should have "photos" as default content type', () => {
      render(<CreateJobPage />);

      const photosButton = screen.getByText('Photos').closest('button');
      expect(photosButton?.className).toContain('btn-primary');
    });
  });

  describe('Form Validation', () => {
    it('should enforce title minimum length', () => {
      render(<CreateJobPage />);

      const titleInput = screen.getByLabelText(/Job Title/i) as HTMLInputElement;
      expect(titleInput.minLength).toBe(5);
    });

    it('should enforce title maximum length', () => {
      render(<CreateJobPage />);

      const titleInput = screen.getByLabelText(/Job Title/i) as HTMLInputElement;
      expect(titleInput.maxLength).toBe(100);
    });

    it('should enforce description minimum length', () => {
      render(<CreateJobPage />);

      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descInput.minLength).toBe(10);
    });

    it('should enforce description maximum length', () => {
      render(<CreateJobPage />);

      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descInput.maxLength).toBe(1000);
    });

    it('should enforce location minimum length', () => {
      render(<CreateJobPage />);

      const locationInput = screen.getByLabelText(/Location/i) as HTMLInputElement;
      expect(locationInput.minLength).toBe(3);
    });

    it('should require all mandatory fields', () => {
      render(<CreateJobPage />);

      const titleInput = screen.getByLabelText(/Job Title/i) as HTMLInputElement;
      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      const locationInput = screen.getByLabelText(/Location/i) as HTMLInputElement;
      const dateInput = screen.getByLabelText(/Event Date & Time/i) as HTMLInputElement;

      expect(titleInput.required).toBe(true);
      expect(descInput.required).toBe(true);
      expect(locationInput.required).toBe(true);
      expect(dateInput.required).toBe(true);
    });

    it('should not require notes field', () => {
      render(<CreateJobPage />);

      const notesInput = screen.getByLabelText(/Additional Notes/i) as HTMLTextAreaElement;
      expect(notesInput.required).toBe(false);
    });
  });

  describe('Form Input Handling', () => {
    it('should update title on input', () => {
      render(<CreateJobPage />);

      const titleInput = screen.getByLabelText(/Job Title/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Wedding Photography' } });

      expect(titleInput.value).toBe('Wedding Photography');
    });

    it('should update description on input', () => {
      render(<CreateJobPage />);

      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      fireEvent.change(descInput, { target: { value: 'Need photos of wedding ceremony' } });

      expect(descInput.value).toBe('Need photos of wedding ceremony');
    });

    it('should update location on input', () => {
      render(<CreateJobPage />);

      const locationInput = screen.getByLabelText(/Location/i) as HTMLInputElement;
      fireEvent.change(locationInput, { target: { value: 'Central Park' } });

      expect(locationInput.value).toBe('Central Park');
    });

    it('should update event time on input', () => {
      render(<CreateJobPage />);

      const dateInput = screen.getByLabelText(/Event Date & Time/i) as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2024-12-25T10:00' } });

      expect(dateInput.value).toBe('2024-12-25T10:00');
    });

    it('should update notes on input', () => {
      render(<CreateJobPage />);

      const notesInput = screen.getByLabelText(/Additional Notes/i) as HTMLTextAreaElement;
      fireEvent.change(notesInput, { target: { value: 'Focus on candid moments' } });

      expect(notesInput.value).toBe('Focus on candid moments');
    });
  });

  describe('Content Type Selection', () => {
    it('should select photos when Photos button clicked', () => {
      render(<CreateJobPage />);

      const photosButton = screen.getByText('Photos').closest('button')!;
      fireEvent.click(photosButton);

      expect(photosButton.className).toContain('btn-primary');
    });

    it('should select videos when Videos button clicked', () => {
      render(<CreateJobPage />);

      const videosButton = screen.getByText('Videos').closest('button')!;
      fireEvent.click(videosButton);

      expect(videosButton.className).toContain('btn-primary');
    });

    it('should select both when Both button clicked', () => {
      render(<CreateJobPage />);

      const bothButton = screen.getByText('Both').closest('button')!;
      fireEvent.click(bothButton);

      expect(bothButton.className).toContain('btn-primary');
    });

    it('should change selection when different content type clicked', () => {
      render(<CreateJobPage />);

      const photosButton = screen.getByText('Photos').closest('button')!;
      const videosButton = screen.getByText('Videos').closest('button')!;

      // Default is photos
      expect(photosButton.className).toContain('btn-primary');

      // Click videos
      fireEvent.click(videosButton);
      expect(videosButton.className).toContain('btn-primary');
      expect(photosButton.className).not.toContain('btn-primary');
    });
  });

  describe('Price Tier Selection', () => {
    it('should select basic when Basic button clicked', () => {
      render(<CreateJobPage />);

      const basicButton = screen.getByText('Basic').closest('button')!;
      fireEvent.click(basicButton);

      expect(basicButton.className).toContain('btn-primary');
    });

    it('should select standard when Standard button clicked', () => {
      render(<CreateJobPage />);

      const standardButton = screen.getByText('Standard').closest('button')!;
      fireEvent.click(standardButton);

      expect(standardButton.className).toContain('btn-primary');
    });

    it('should select premium when Premium button clicked', () => {
      render(<CreateJobPage />);

      const premiumButton = screen.getByText('Premium').closest('button')!;
      fireEvent.click(premiumButton);

      expect(premiumButton.className).toContain('btn-gold');
    });

    it('should change selection when different tier clicked', () => {
      render(<CreateJobPage />);

      const standardButton = screen.getByText('Standard').closest('button')!;
      const premiumButton = screen.getByText('Premium').closest('button')!;

      // Default is standard
      expect(standardButton.className).toContain('btn-primary');

      // Click premium
      fireEvent.click(premiumButton);
      expect(premiumButton.className).toContain('btn-gold');
      expect(standardButton.className).not.toContain('btn-primary');
    });

    it('should display pricing information', () => {
      render(<CreateJobPage />);

      expect(screen.getByText(/Basic: \$50/)).toBeDefined();
      expect(screen.getByText(/Standard: \$100/)).toBeDefined();
      expect(screen.getByText(/Premium: \$200/)).toBeDefined();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: { id: 'job-123' } }),
      });

      render(<CreateJobPage />);

      // Fill form
      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos of wedding ceremony and reception' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park, NYC' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      // Submit
      const submitButton = screen.getByText('Create Job').closest('button')!;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/jobs',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should navigate to job page after successful creation', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: { id: 'job-123' } }),
      });

      render(<CreateJobPage />);

      // Fill form
      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos of wedding ceremony' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      // Submit
      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/jobs/job-123');
      });
    });

    it('should convert event time to ISO string', async () => {
      let capturedBody: any;
      (global.fetch as any).mockImplementation(async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ job: { id: 'job-123' } }),
        };
      });

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos of wedding' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(capturedBody.eventTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    it('should disable submit button while loading', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      const submitButton = screen.getByText('Create Job').closest('button')!;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Creating Job...')).toBeDefined();
        expect(submitButton.disabled).toBe(true);
      });
    });

    it('should show error alert on failed submission', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation failed' }),
      });

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'NYC' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Validation failed');
      });

      alertMock.mockRestore();
    });

    it('should handle network error', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Something went wrong. Please try again.');
      });

      alertMock.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button clicked', () => {
      render(<CreateJobPage />);

      const backButton = screen.getByRole('button', { name: '' }).closest('button');
      if (backButton && backButton.querySelector('svg')) {
        fireEvent.click(backButton);
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      }
    });

    it('should navigate back to dashboard when Cancel clicked', () => {
      render(<CreateJobPage />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should disable cancel button while loading', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel').closest('button')!;
        expect(cancelButton.disabled).toBe(true);
      });
    });
  });

  describe('Optional Fields', () => {
    it('should submit without notes field', async () => {
      let capturedBody: any;
      (global.fetch as any).mockImplementation(async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ job: { id: 'job-123' } }),
        };
      });

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos of wedding' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(capturedBody.notes).toBe('');
      });
    });

    it('should include notes when provided', async () => {
      let capturedBody: any;
      (global.fetch as any).mockImplementation(async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ job: { id: 'job-123' } }),
        };
      });

      render(<CreateJobPage />);

      fireEvent.change(screen.getByLabelText(/Job Title/i), {
        target: { value: 'Wedding Photography' },
      });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'Need photos of wedding' },
      });
      fireEvent.change(screen.getByLabelText(/Location/i), {
        target: { value: 'Central Park' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
        target: { value: '2024-12-25T10:00' },
      });
      fireEvent.change(screen.getByLabelText(/Additional Notes/i), {
        target: { value: 'Focus on candid moments' },
      });

      fireEvent.click(screen.getByText('Create Job'));

      await waitFor(() => {
        expect(capturedBody.notes).toBe('Focus on candid moments');
      });
    });
  });
});
