# Snapspot

A mobile-first, Uber-style web platform for content capture jobs. Requesters post nearby photo/video capture tasks, Helpers scan QR codes to accept jobs, capture content, and upload to secure cloud storage.

## 🏗️ Architecture

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Auth:** Amazon Cognito User Pool + Hosted UI (Google OAuth)
- **Database:** PostgreSQL + Prisma ORM
- **Storage:** AWS S3 (LocalStack for local dev)
- **Testing:** Jest, React Testing Library, Playwright

**Key Design Decisions:**
1. Single responsive web app with role-based routing (Requester/Helper)
2. Server-side JWT validation in Next.js route handlers
3. Pre-signed S3 URLs with job-based authorization
4. Simple append-only messaging (no real-time in Phase 1)
5. QR codes encode short-lived tokens validated server-side (15-min expiry)

## 📁 Project Structure

```
snapspot/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed script with mock data
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── api/               # API route handlers
│   │   │   ├── auth/          # Login, logout, callback, me
│   │   │   ├── jobs/          # Job CRUD, QR, join, messages, uploads
│   │   │   └── uploads/       # Pre-signed URL generation
│   │   ├── dashboard/         # Role-based dashboard
│   │   ├── jobs/              # Job pages (create, view, join)
│   │   └── onboarding/role/   # Role selection
│   ├── lib/
│   │   ├── auth/              # Cognito + JWT verification
│   │   ├── db/                # Prisma client
│   │   ├── storage/           # S3 utilities
│   │   ├── qr/                # QR token generation/validation
│   │   └── validation/        # Zod schemas
│   ├── components/            # Reusable React components
│   ├── store/                 # Zustand state management
│   └── types/                 # TypeScript types
├── __tests__/                 # Unit, component, E2E tests
├── docker-compose.yml         # PostgreSQL + LocalStack
└── scripts/                   # Utility scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- AWS Account (for Cognito setup)

### 1. AWS Cognito Setup

1. Create a Cognito User Pool in AWS Console
2. Enable Google identity provider:
   - Get Google OAuth credentials from Google Cloud Console
   - Add to Cognito → Identity providers → Google
3. Configure App Client:
   - Enable "Hosted UI"
   - Allowed callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed sign-out URLs: `http://localhost:3000`
   - OAuth flows: Authorization code grant
   - OAuth scopes: openid, email, profile
4. Note these values:
   - User Pool ID
   - App Client ID
   - Cognito Domain

### 2. Environment Setup

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local with your Cognito credentials
# Update:
# - COGNITO_USER_POOL_ID
# - COGNITO_CLIENT_ID
# - COGNITO_DOMAIN
# - NEXT_PUBLIC_COGNITO_DOMAIN
# - COGNITO_ISSUER
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Services

```bash
# Start PostgreSQL and LocalStack
npm run docker:up

# Wait for services to be healthy (check logs)
docker-compose logs -f
```

### 5. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed mock data
npm run db:seed
```

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# Unit tests only
npm test

# Component tests
npm test -- components

# E2E tests (requires running dev server)
npm run test:e2e

# Watch mode
npm run test:watch
```

## 🔑 Authentication Flow

1. User clicks "Sign in with Google"
2. Redirects to `/api/auth/login`
3. Server generates PKCE challenge, stores verifier in cookie
4. Redirects to Cognito Hosted UI
5. User authenticates with Google
6. Cognito redirects to `/api/auth/callback` with authorization code
7. Server exchanges code for tokens using PKCE verifier
8. Server verifies JWT, creates/updates user in DB
9. If `user.role` is null → redirect to `/onboarding/role`
10. If `user.role` is set → redirect to `/dashboard`

## 🔐 Authorization Model

- **Server-side JWT verification** in all API routes
- **Role-based access control:**
  - Requesters: Create jobs, view their jobs, rate Helpers
  - Helpers: Join jobs via QR, upload content, rate Requesters
- **Upload authorization:**
  - Helpers can only upload to jobs they're assigned to
  - Upload access revoked when job status is COMPLETED or CANCELLED
- **QR token security:**
  - 15-minute expiry
  - Single-use (or one Helper per token in Phase 1)
  - Server-side validation only

## 📊 Database Schema

### Core Models

- **User:** Cognito auth, role (REQUESTER | HELPER)
- **Job:** Content capture request with status lifecycle
- **QRToken:** Short-lived join tokens (15-min expiry)
- **Assignment:** Helper-to-job assignment (1:1 in Phase 1)
- **Message:** Append-only notes thread per job
- **Upload:** S3 media files with job authorization
- **Rating:** Bi-directional ratings (Requester ↔ Helper)

### Job Status Lifecycle

```
OPEN → ACCEPTED → IN_PROGRESS → UPLOADED → COMPLETED
                           ↓
                      CANCELLED
```

## 🎯 Core Workflows

### Requester Flow

1. Sign in with Google
2. Select "Requester" role (if first time)
3. Create job (location, time, content type, price tier)
4. Generate QR code for job
5. Show QR to Helper at event
6. Monitor job status and uploads
7. View uploaded content
8. Mark job complete
9. Rate Helper

### Helper Flow

1. Sign in with Google
2. Select "Helper" role (if first time)
3. Scan QR code (or enter short code)
4. View job details and instructions
5. Accept job
6. Capture photos/videos on phone
7. Upload content
8. Mark upload complete
9. Rate Requester

## 📦 API Endpoints

### Authentication
- `GET /api/auth/login` - Initiate OAuth flow
- `GET /api/auth/callback` - OAuth callback
- `GET /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update role (onboarding only)

### Jobs
- `GET /api/jobs` - List jobs (filtered by role)
- `POST /api/jobs` - Create job (Requester only)
- `GET /api/jobs/[id]` - Get job details
- `PATCH /api/jobs/[id]` - Update job
- `POST /api/jobs/[id]/qr` - Generate QR token (Requester only)
- `POST /api/jobs/[id]/join` - Join job via token (Helper only)
- `GET /api/jobs/[id]/messages` - Get messages
- `POST /api/jobs/[id]/messages` - Add message
- `POST /api/jobs/[id]/complete` - Mark job complete (Requester only)
- `POST /api/jobs/[id]/rate` - Submit rating

### Uploads
- `POST /api/uploads/presigned-url` - Get pre-signed S3 URL
- `POST /api/jobs/[id]/uploads` - Record completed upload
- `GET /api/jobs/[id]/uploads` - List uploads for job

## 🎨 UI Style Guide

- **Mobile-first:** All layouts optimized for phone screens
- **Color palette:** Black (#000), White (#FFF), Gold (#D4AF37)
- **Inspiration:** Uber/TaskRabbit simplicity
- **Components:** Thumb-friendly buttons, clear status indicators
- **Error states:** Loading, empty, error, permission-denied handled

## 🧩 Key Files Reference

### Remaining API Routes (Not Yet Created)

You'll need to create these additional route files following the patterns established:

#### `/src/app/api/jobs/[id]/route.ts`
```typescript
// GET: Fetch single job with full details
// PATCH: Update job status (with transition validation)
```

#### `/src/app/api/jobs/[id]/qr/route.ts`
```typescript
// POST: Generate new QR token for job (Requester only)
// Validates job ownership and status
```

#### `/src/app/api/jobs/[id]/join/route.ts`
```typescript
// POST: Join job via QR token (Helper only)
// Validates token, creates assignment, updates job status
```

#### `/src/app/api/jobs/[id]/messages/route.ts`
```typescript
// GET: List messages for job
// POST: Create new message (append-only)
```

#### `/src/app/api/jobs/[id]/uploads/route.ts`
```typescript
// GET: List uploads for job
// POST: Record completed upload (after S3 upload succeeds)
```

#### `/src/app/api/jobs/[id]/complete/route.ts`
```typescript
// POST: Mark job complete (Requester only)
// Validates all uploads present, updates status
```

#### `/src/app/api/jobs/[id]/rate/route.ts`
```typescript
// POST: Submit rating (both roles)
// Validates job completion, ensures one rating per user
```

#### `/src/app/api/uploads/presigned-url/route.ts`
```typescript
// POST: Generate pre-signed S3 URL for upload
// Validates Helper is assigned to job
// Validates job status (must be ACCEPTED or IN_PROGRESS)
// Returns { url, key, bucket }
```

### Frontend Pages (Not Yet Created)

#### `/src/app/page.tsx`
```typescript
// Landing page with "Sign in with Google" button
// Displays error messages from OAuth flow
// Redirects authenticated users to /dashboard
```

#### `/src/app/layout.tsx`
```typescript
// Root layout with Tailwind CSS setup
// Auth state provider
// Mobile-optimized viewport
```

#### `/src/app/onboarding/role/page.tsx`
```typescript
// Role selection page (Requester vs Helper)
// Only shown when user.role is null
// Calls PATCH /api/auth/me to set role
```

#### `/src/app/dashboard/page.tsx`
```typescript
// Role-based dashboard
// Requesters: List of their jobs, "Create Job" button
// Helpers: List of assigned jobs, "Scan QR" button
```

#### `/src/app/jobs/create/page.tsx`
```typescript
// Create job form (Requester only)
// Fields: title, description, location, eventTime, contentType, notes, priceTier
// Validates with Zod, posts to /api/jobs
```

#### `/src/app/jobs/[id]/page.tsx`
```typescript
// Job details page (both roles, different views)
// Requester view: Job info, QR code, uploads, messages, "Complete" button
// Helper view: Job info, upload button, messages, "Mark Done" button
```

#### `/src/app/jobs/join/[token]/page.tsx`
```typescript
// Join job via QR token (Helper only)
// Validates token, shows job preview, "Accept Job" button
```

### UI Components (Not Yet Created)

#### `/src/components/auth/AuthButton.tsx`
```typescript
// Sign in / Sign out button
// Checks auth state, shows user name when logged in
```

#### `/src/components/jobs/CreateJobForm.tsx`
```typescript
// Job creation form with validation
// Mobile-optimized inputs, date/time picker
```

#### `/src/components/jobs/JobCard.tsx`
```typescript
// Job summary card for list views
// Shows status, location, time, price tier
```

#### `/src/components/jobs/JobStatusPanel.tsx`
```typescript
// Visual status indicator with progress
// Shows current status and next steps
```

#### `/src/components/jobs/QRCodeDisplay.tsx`
```typescript
// QR code generator using qrcode library
// Shows QR + backup short code
// Auto-refreshes on expiry
```

#### `/src/components/jobs/UploadZone.tsx`
```typescript
// File upload component
// Camera input on mobile, file picker fallback
// Requests pre-signed URL, uploads to S3
// Shows upload progress, previews
```

#### `/src/components/layout/Header.tsx`
```typescript
// App header with logo, auth button
// Mobile-friendly navigation
```

#### `/src/components/layout/RoleGuard.tsx`
```typescript
// Client-side role guard component
// Redirects to /onboarding/role if no role
// Shows loading state while checking auth
```

#### `/src/components/ui/Button.tsx`
```typescript
// Reusable button component
// Variants: primary, secondary, danger
// Mobile-optimized touch targets
```

#### `/src/components/ui/Input.tsx`
```typescript
// Form input component with validation states
```

#### `/src/components/ui/LoadingSpinner.tsx`
```typescript
// Loading indicator
```

### State Management

#### `/src/store/authStore.ts`
```typescript
// Zustand store for auth state
// Fetches /api/auth/me on load
// Provides { user, loading, error, refreshUser }
```

### Configuration Files

#### `/next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'], // Add S3/CloudFront domains in production
  },
};

module.exports = nextConfig;
```

#### `/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
      },
    },
  },
  plugins: [],
};
export default config;
```

#### `/postcss.config.js`
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

#### `/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `/.eslintrc.json`
```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

#### `/.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

#### `/jest.config.js`
```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
    '**/__tests__/components/**/*.test.tsx',
  ],
};

module.exports = createJestConfig(customJestConfig);
```

#### `/jest.setup.js`
```javascript
import '@testing-library/jest-dom';
```

#### `/playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 🔍 Testing Strategy

### Unit Tests

Test validation logic and business rules:

- `/tests/unit/validation.test.ts` - Zod schema validation
- `/__tests__/unit/status-transitions.test.ts` - Job status FSM

### Component Tests

Test React components in isolation:

- `/__tests__/components/CreateJobForm.test.tsx`
- `/__tests__/components/JobStatusPanel.test.tsx`

### E2E Tests

Test complete user flows:

- `/__tests__/e2e/auth.spec.ts` - OAuth flow, JWT verification
- `/__tests__/e2e/requester-flow.spec.ts` - Create job → QR → view uploads
- `/__tests__/e2e/helper-flow.spec.ts` - Scan QR → upload → complete

## 📝 Seed Data

Run `npm run db:seed` to populate:

- 8 users (4 Requesters, 4 Helpers)
- 12 jobs in various statuses
- Mock assignments, messages, uploads, ratings
- Valid QR tokens for testing

## 🚧 Phase 1 Limitations

Explicitly NOT implemented:

- ❌ Real payments (UI only, no Stripe)
- ❌ Maps/GPS/proximity (text location only)
- ❌ Push notifications
- ❌ Background jobs/queues
- ❌ Multi-helper jobs (1:1 only)
- ❌ Admin dashboard (stub only)
- ❌ Real-time updates (polling only)

## 🔒 Security Checklist

✅ Server-side JWT verification (JWKS)
✅ Role-based access control
✅ Pre-signed S3 URLs (no direct credentials)
✅ Upload authorization per job
✅ PKCE for OAuth flow
✅ HTTP-only cookies for tokens
✅ Input validation (Zod)
✅ SQL injection protection (Prisma)
✅ CSRF protection (SameSite cookies)
✅ S3 key sanitization (never trust client filenames)

## 📚 Additional Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Cognito Hosted UI Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [Prisma Docs](https://www.prisma.io/docs)
- [LocalStack S3 Docs](https://docs.localstack.cloud/user-guide/aws/s3/)

## 🐛 Troubleshooting

### Cognito Authentication Issues

- Verify callback URL matches exactly in Cognito console
- Check PKCE verifier cookie is being set
- Ensure COGNITO_ISSUER matches User Pool

### Database Connection

```bash
# Check PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Reset database
npm run db:reset
```

### LocalStack S3 Issues

```bash
# Verify bucket exists
docker-compose exec localstack awslocal s3 ls

# Check CORS configuration
docker-compose exec localstack awslocal s3api get-bucket-cors --bucket snapspot-uploads
```

## 📄 License

MIT (for POC purposes)

---

**Success Criteria:**

✅ Local developer can install dependencies
✅ Seed data populates successfully
✅ Requester can create job and generate QR
✅ Helper can join via QR/short code
✅ Helper can upload mock media
✅ Job can be completed and rated
✅ Full test suite passes

**Next Steps for Production:**

1. Add real payment processing (Stripe)
2. Implement map-based job discovery
3. Add push notifications (FCM)
4. Optimize image processing (thumbnails, compression)
5. Add content moderation
6. Scale S3 upload handling
7. Add CloudFront CDN
8. Implement rate limiting
9. Add analytics/monitoring
10. Multi-helper job support
