import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

/**
 * Landing Page Component Tests
 * Tests hero section, feature cards, and sign-in button
 */

describe.skip('Landing Page Component - TODO: Implement component', () => {
  describe('Page Structure', () => {
    it('should render landing page', () => {
      render(<HomePage />);

      expect(screen.getByText('Snapspot')).toBeDefined();
    });

    it('should have header with logo', () => {
      render(<HomePage />);

      const header = document.querySelector('header');
      expect(header).toBeDefined();
      expect(screen.getByText('Snapspot')).toBeDefined();
    });

    it('should have hero section', () => {
      render(<HomePage />);

      const hero = document.querySelector('section');
      expect(hero).toBeDefined();
    });

    it('should have features section', () => {
      render(<HomePage />);

      expect(screen.getByText('How It Works')).toBeDefined();
    });

    it('should have footer', () => {
      render(<HomePage />);

      const footer = document.querySelector('footer');
      expect(footer).toBeDefined();
      expect(screen.getByText(/© 2025 Snapspot/)).toBeDefined();
    });
  });

  describe('Hero Section', () => {
    it('should display main heading', () => {
      render(<HomePage />);

      expect(screen.getByText(/Content Capture/i)).toBeDefined();
      expect(screen.getByText(/On Demand/i)).toBeDefined();
    });

    it('should highlight "On Demand" in gold', () => {
      render(<HomePage />);

      const goldText = screen.getByText(/On Demand/i);
      expect(goldText.className).toContain('text-gold');
    });

    it('should display hero description', () => {
      render(<HomePage />);

      expect(
        screen.getByText(/Connect Requesters with Helpers for real-time photo and video capture/)
      ).toBeDefined();
    });

    it('should show sign-in button', () => {
      render(<HomePage />);

      const signInButton = screen.getByText(/Sign in with Google/i);
      expect(signInButton).toBeDefined();
    });

    it('should link sign-in button to auth endpoint', () => {
      render(<HomePage />);

      const signInButton = screen.getByText(/Sign in with Google/i).closest('a');
      expect(signInButton?.href).toContain('/api/auth/login');
    });

    it('should display Google icon', () => {
      render(<HomePage />);

      const signInButton = screen.getByText(/Sign in with Google/i).closest('a');
      const svg = signInButton?.querySelector('svg');
      expect(svg).toBeDefined();
    });

    it('should show "No credit card required" message', () => {
      render(<HomePage />);

      expect(screen.getByText(/No credit card required/)).toBeDefined();
      expect(screen.getByText(/Free to start/)).toBeDefined();
    });
  });

  describe('Features Section - Requesters', () => {
    it('should display "For Requesters" heading', () => {
      render(<HomePage />);

      expect(screen.getByText('For Requesters')).toBeDefined();
    });

    it('should list requester features', () => {
      render(<HomePage />);

      expect(screen.getByText(/Create content capture jobs/)).toBeDefined();
      expect(screen.getByText(/Generate QR codes for events/)).toBeDefined();
      expect(screen.getByText(/Review and download uploads/)).toBeDefined();
      expect(screen.getByText(/Rate your Helpers/)).toBeDefined();
    });

    it('should display requester icon', () => {
      render(<HomePage />);

      const requesterCard = screen.getByText('For Requesters').closest('div');
      const icon = requesterCard?.querySelector('svg');
      expect(icon).toBeDefined();
    });

    it('should show checkmarks for features', () => {
      render(<HomePage />);

      const requesterCard = screen.getByText('For Requesters').closest('div');
      const checkmarks = requesterCard?.innerHTML.match(/✓/g);
      expect(checkmarks?.length).toBe(4);
    });
  });

  describe('Features Section - Helpers', () => {
    it('should display "For Helpers" heading', () => {
      render(<HomePage />);

      expect(screen.getByText('For Helpers')).toBeDefined();
    });

    it('should list helper features', () => {
      render(<HomePage />);

      expect(screen.getByText(/Scan QR codes to join jobs/)).toBeDefined();
      expect(screen.getByText(/Capture photos and videos/)).toBeDefined();
      expect(screen.getByText(/Upload directly from your phone/)).toBeDefined();
      expect(screen.getByText(/Get rated and build reputation/)).toBeDefined();
    });

    it('should display helper icon', () => {
      render(<HomePage />);

      const helperCard = screen.getByText('For Helpers').closest('div');
      const icon = helperCard?.querySelector('svg');
      expect(icon).toBeDefined();
    });

    it('should show checkmarks for features', () => {
      render(<HomePage />);

      const helperCard = screen.getByText('For Helpers').closest('div');
      const checkmarks = helperCard?.innerHTML.match(/✓/g);
      expect(checkmarks?.length).toBe(4);
    });
  });

  describe('Visual Styling', () => {
    it('should use card styling for feature sections', () => {
      render(<HomePage />);

      const requesterCard = screen.getByText('For Requesters').closest('.card');
      const helperCard = screen.getByText('For Helpers').closest('.card');

      expect(requesterCard).toBeDefined();
      expect(helperCard).toBeDefined();
    });

    it('should have black background for requester icon', () => {
      render(<HomePage />);

      const requesterCard = screen.getByText('For Requesters').closest('div');
      const iconContainer = requesterCard?.querySelector('.bg-black');
      expect(iconContainer).toBeDefined();
    });

    it('should have gold background for helper icon', () => {
      render(<HomePage />);

      const helperCard = screen.getByText('For Helpers').closest('div');
      const iconContainer = helperCard?.querySelector('.bg-gold');
      expect(iconContainer).toBeDefined();
    });

    it('should use responsive grid for features', () => {
      render(<HomePage />);

      const featuresContainer = screen.getByText('For Requesters').closest('div')?.parentElement;
      expect(featuresContainer?.className).toContain('grid');
      expect(featuresContainer?.className).toContain('md:grid-cols-2');
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', () => {
      render(<HomePage />);

      const main = document.querySelector('main');
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const sections = document.querySelectorAll('section');

      expect(main).toBeDefined();
      expect(header).toBeDefined();
      expect(footer).toBeDefined();
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should have proper heading hierarchy', () => {
      render(<HomePage />);

      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h3 = document.querySelector('h3');
      const h4s = document.querySelectorAll('h4');

      expect(h1).toBeDefined();
      expect(h2).toBeDefined();
      expect(h3).toBeDefined();
      expect(h4s.length).toBe(2); // For Requesters & For Helpers
    });

    it('should have accessible sign-in button', () => {
      render(<HomePage />);

      const signInButton = screen.getByText(/Sign in with Google/i);
      expect(signInButton.tagName).toBe('A');
      expect(signInButton.closest('a')?.href).toBeTruthy();
    });
  });

  describe('Content', () => {
    it('should mention key platform features', () => {
      render(<HomePage />);

      const content = document.body.textContent || '';

      expect(content).toContain('QR code');
      expect(content).toContain('photo');
      expect(content).toContain('video');
      expect(content).toContain('upload');
      expect(content).toContain('Requester');
      expect(content).toContain('Helper');
    });

    it('should have clear call-to-action', () => {
      render(<HomePage />);

      expect(screen.getByText(/Sign in with Google/i)).toBeDefined();
      expect(screen.getByText(/No credit card required/)).toBeDefined();
      expect(screen.getByText(/Free to start/)).toBeDefined();
    });

    it('should explain the platform value proposition', () => {
      render(<HomePage />);

      expect(
        screen.getByText(/Connect Requesters with Helpers for real-time photo and video capture/)
      ).toBeDefined();
    });
  });

  describe('Footer', () => {
    it('should display copyright', () => {
      render(<HomePage />);

      expect(screen.getByText(/© 2025 Snapspot/)).toBeDefined();
    });

    it('should mention tech stack', () => {
      render(<HomePage />);

      expect(screen.getByText(/Built with Next.js and AWS/)).toBeDefined();
    });

    it('should center footer text', () => {
      render(<HomePage />);

      const footer = document.querySelector('footer');
      expect(footer?.className).toContain('text-center');
    });
  });

  describe('Responsive Design', () => {
    it('should use container-safe class for padding', () => {
      render(<HomePage />);

      const containers = document.querySelectorAll('.container-safe');
      expect(containers.length).toBeGreaterThan(0);
    });

    it('should have responsive text sizes', () => {
      render(<HomePage />);

      const mainHeading = screen.getByText(/Content Capture/).closest('h2');
      expect(mainHeading?.className).toContain('md:');
    });

    it('should have responsive grid layout', () => {
      render(<HomePage />);

      const grid = screen.getByText('For Requesters').closest('div')?.parentElement;
      expect(grid?.className).toContain('md:grid-cols-2');
    });
  });

  describe('Branding', () => {
    it('should use gold brand color', () => {
      render(<HomePage />);

      const goldElements = document.querySelectorAll('.text-gold, .bg-gold');
      expect(goldElements.length).toBeGreaterThan(0);
    });

    it('should display Snapspot branding consistently', () => {
      render(<HomePage />);

      const snapspotMentions = document.body.textContent?.match(/Snapspot/g);
      expect(snapspotMentions?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
