# Snapspot Testing Guide

This project includes comprehensive testing coverage across multiple levels.

## Test Structure

```
tests/
├── unit/              # Unit tests for utility functions
├── integration/       # Integration tests for API routes & database
├── component/         # React component tests
├── contract/          # API contract tests
├── security/          # Security & authorization tests
├── performance/       # Performance & load tests
├── e2e/              # End-to-end tests with Playwright
└── setup.ts          # Test setup and global config
```

## Running Tests

### All Tests
```bash
npm test                 # Run all Vitest tests
npm run test:all        # Run all tests including E2E
```

### Unit Tests
```bash
npm run test:unit       # Run unit tests only
npm run test:watch      # Run tests in watch mode
npm run test:ui         # Open Vitest UI
```

### Integration Tests
```bash
npm run test:integration
```

### Component Tests
```bash
npm run test:component
```

### Contract Tests
```bash
npm run test:contract
```

### Security Tests
```bash
npm run test:security   # Run authorization & file upload security tests
```

### Performance Tests
```bash
npm run test:performance # Run load testing & performance benchmarks
```

### E2E Tests
```bash
npm run test:e2e               # Run all E2E tests
npm run test:e2e:ui            # Run E2E with Playwright UI
npm run test:e2e:browser       # Run browser compatibility tests
npm run test:e2e:accessibility # Run WCAG 2.1 AA accessibility tests
```

### Coverage
```bash
npm run test:coverage   # Generate coverage report
```

## Test Types

### 1. Unit Tests (`tests/unit/`)
Test individual functions and utilities in isolation.

**Examples:**
- `pricing.test.ts` - Tests pricing calculations
- `s3.test.ts` - Tests S3 key generation and URL formatting
- `validation.test.ts` - Tests status transition validation
- `auth-cognito.test.ts` - Tests PKCE generation, OAuth URL construction
- `auth-jwt.test.ts` - Tests JWT token extraction
- `auth-middleware.test.ts` - Tests response helper functions
- `qr-token.test.ts` - Tests QR token generation logic (HMAC, short codes)
- `schemas.test.ts` - Tests all Zod validation schemas

### 2. Integration Tests (`tests/integration/`)
Test API routes and database interactions.

**Examples:**
- `jobs-api.test.ts` - Tests job CRUD operations with real database
- `qr-code.test.ts` - Tests QR token generation, expiration, validation
- `error-handling.test.ts` - Tests input validation, database errors, edge cases
- `database-integrity.test.ts` - Tests transactions, foreign keys, concurrent operations

### 3. Component Tests (`tests/component/`)
Test React components with user interactions.

**Example:**
- `JobCard.test.tsx` - Tests job card rendering and interactions

### 4. Contract Tests (`tests/contract/`)
Verify API request/response contracts using Zod schemas.

**Example:**
- `api-contracts.test.ts` - Validates API schemas match documentation

### 5. Security Tests (`tests/security/`)
Test authorization, permissions, and security vulnerabilities.

**Examples:**
- `authorization.test.ts` - Tests role-based access control, upload permissions
- `file-upload.test.ts` - Tests file validation, malicious file detection, path traversal prevention

### 6. Performance Tests (`tests/performance/`)
Test system performance under load.

**Example:**
- `load-testing.test.ts` - Tests concurrent requests, database query performance, memory usage

### 7. E2E Tests (`tests/e2e/`)
Test complete user flows in a real browser.

**Examples:**
- `job-lifecycle.spec.ts` - Tests full job creation → upload → review → approval flow
- `browser-compatibility.spec.ts` - Tests across Chrome, Safari, different screen sizes
- `accessibility.spec.ts` - Tests WCAG 2.1 AA compliance, keyboard navigation, screen readers

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { getPriceAmount } from '@/lib/pricing';

describe('getPriceAmount', () => {
  it('should return correct price for basic tier', () => {
    expect(getPriceAmount('basic')).toBe(50);
  });
});
```

### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

it('should render component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('should create a job', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('button:has-text("Create Job")');
  // ... test interactions
});
```

## CI/CD Integration

Tests run automatically in CI:
```bash
# In CI pipeline
npm run test:all
```

## Coverage Goals

- **Unit Tests**: 80%+ coverage for utility functions
- **Integration Tests**: All critical API routes and database operations
- **Component Tests**: All user-facing components
- **Contract Tests**: All public APIs
- **Security Tests**: Authorization, file upload, input validation
- **Performance Tests**: Query performance, concurrent operations, memory usage
- **E2E Tests**: All happy paths + error scenarios
- **Accessibility Tests**: WCAG 2.1 AA compliance

## Test Database

Integration tests use a separate test database:
```
DATABASE_URL="postgresql://snapspot:snapspot_dev_password@localhost:5432/snapspot_test"
```

## Mocking

- **Next.js Router**: Mocked in component tests
- **AWS S3**: Mocked in unit tests
- **MediaDevices**: Mocked in E2E tests
- **Cognito Auth**: Mocked in integration tests (using test users)

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Test Behavior**: Focus on what users experience
3. **Avoid Implementation Details**: Test the interface, not internals
4. **Descriptive Names**: Use clear test descriptions
5. **Independent Tests**: Each test should run independently
6. **Fast Tests**: Keep unit tests under 1ms each

## Troubleshooting

### Tests failing locally?
```bash
# Reset test database
npm run db:reset

# Clear Vitest cache
npx vitest run --no-cache
```

### E2E tests failing?
```bash
# Update Playwright browsers
npx playwright install

# Run with debug mode
npx playwright test --debug
```

### Need to see what's happening?
```bash
# Open Vitest UI
npm run test:ui

# Open Playwright UI
npm run test:e2e:ui
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
