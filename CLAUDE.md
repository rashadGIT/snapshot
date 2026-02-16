# Snapspot - Claude Code Guidelines

## Project Overview

Snapspot is a photo-sharing platform for event photography. Users (Requesters) can create photo jobs, generate QR codes for events, and Helpers can scan QR codes to upload photos directly to S3.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: AWS Cognito (OAuth with Google, PKCE flow)
- **Storage**: AWS S3 (LocalStack for local development)
- **State Management**: Zustand
- **Validation**: Zod
- **Styling**: Tailwind CSS

## Testing Requirements

**IMPORTANT: All code changes MUST include corresponding test cases.**

When modifying or adding code:
1. Write unit tests for new utility functions and business logic
2. Write integration tests for API endpoints
3. Write component tests for React components with user interactions
4. Update existing tests if behavior changes

### Required Test Coverage (must be considered for every change)
Ensure coverage exists or is added across:
- Unit
- Contract
- Component
- Acceptance
- End-to-end
- Performance
- Security
- Resiliency

If a category is not applicable for a change, document why it is not applicable.

### Test Structure

```
tests/
├── unit/           # Pure function tests, utilities, schemas
├── integration/    # API endpoint tests, database operations
├── component/      # React component tests with Testing Library
├── contract/       # API contract validation tests
├── security/       # Authorization and security tests
├── e2e/            # Playwright end-to-end tests
├── performance/    # Performance benchmarks
├── smoke/          # Critical path smoke tests
└── setup.ts        # Test configuration
```

### Running Tests

```bash
npm test              # Run all Vitest tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e      # Playwright E2E tests
npm run test:coverage # With coverage report
```

### Test Writing Guidelines

Use Vitest with this pattern:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do expected behavior', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

For API routes, test:
- Success cases with valid input
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)

For components, use Testing Library:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # API endpoints
│   └── (pages)/      # Page components
├── components/       # Reusable React components
├── lib/              # Utilities and business logic
│   ├── auth/         # Cognito authentication
│   ├── storage/      # S3 utilities
│   ├── db/           # Prisma database helpers
│   └── utils/        # Shared utilities
├── store/            # Zustand stores
└── types/            # TypeScript type definitions
```

## Key Files

- `src/lib/storage/s3.ts` - S3 upload/download utilities
- `src/lib/auth/cognito.ts` - Cognito OAuth flow
- `src/lib/auth/jwt.ts` - JWT verification
- `prisma/schema.prisma` - Database schema

## Development Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run db:push       # Push schema to database
npm run db:seed       # Seed database
./setup-local.sh      # Setup LocalStack for local S3
```

## Environment Variables

Local development uses `.env.local` with LocalStack. Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_S3_BUCKET` / `S3_BUCKET` - S3 bucket name
- `AWS_ACCESS_KEY_ID` / `S3_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` / `S3_SECRET_ACCESS_KEY` - AWS credentials
- `COGNITO_*` - Cognito configuration

## Code Style & Best Practices

**IMPORTANT: Always follow coding best practices. Code must be well-commented and human-readable.**

### Readability
- Write clear, self-documenting code with meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Use early returns to reduce nesting
- Break complex logic into smaller, well-named helper functions

### Comments
- Add JSDoc comments to all exported functions explaining purpose, parameters, and return values
- Comment complex business logic explaining the "why", not just the "what"
- Add inline comments for non-obvious code sections
- Keep comments up-to-date when modifying code

### TypeScript
- Use TypeScript strict mode
- Define explicit types for function parameters and return values
- Prefer interfaces for object shapes, types for unions/primitives
- Avoid `any` - use `unknown` with type guards when type is uncertain

### General
- Validate inputs with Zod schemas
- Handle errors explicitly, never swallow errors silently
- Use path aliases (`@/` maps to `src/`)
- Run `npm run lint` and `npm run type-check` before committing
- Follow DRY (Don't Repeat Yourself) - extract reusable logic
- Follow KISS (Keep It Simple) - prefer simple solutions over clever ones

## Accessibility (ADA Compliance)

**IMPORTANT: All code must be ADA compliant following WCAG 2.1 AA standards.**

### Requirements
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<header>`, etc.)
- Provide `alt` text for all images
- Ensure sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- Support keyboard navigation for all interactive elements
- Add ARIA labels and roles where semantic HTML is insufficient
- Ensure forms have associated labels and clear error messages
- Never rely on color alone to convey information

### Testing for Accessibility
- Run accessibility tests using the existing Playwright + axe-core setup:
  ```bash
  npm run test:e2e:accessibility
  ```
- Test keyboard navigation manually (Tab, Enter, Escape, Arrow keys)
- Test with screen readers when possible
- Include accessibility assertions in component tests:
  ```typescript
  import { axe, toHaveNoViolations } from 'jest-axe';
  expect(await axe(container)).toHaveNoViolations();
  ```

### Component Checklist
- [ ] Interactive elements are focusable and have visible focus states
- [ ] Images have descriptive alt text
- [ ] Form inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Modal dialogs trap focus and can be closed with Escape
- [ ] Loading states are announced to assistive technology

## Security Considerations

- Never trust client-provided filenames (sanitize in `generateS3Key`)
- Validate user permissions on all API routes
- Use pre-signed URLs for S3 uploads (15-minute expiry)
- Verify JWT tokens on protected endpoints

## AWS Well-Architected Pillars (must be considered for every change)

When writing or modifying code, ensure decisions consider all six pillars:
- Operational Excellence
- Security
- Reliability
- Performance Efficiency
- Cost Optimization
- Sustainability

If a pillar is not applicable, document why it is not applicable.
