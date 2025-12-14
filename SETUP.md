# Snapspot - Quick Start Guide

This guide will get you running locally in under 10 minutes.

## Prerequisites Checklist

- ✅ Node.js 20+ installed (`node --version`)
- ✅ Docker & Docker Compose installed (`docker --version`)
- ✅ AWS account with access to create Cognito resources
- ✅ Google Cloud Console account (for OAuth credentials)

## Step 1: AWS Cognito Setup (5 minutes)

### 1.1 Create User Pool

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click "Create user pool"
3. Choose "Federated identity providers" and "Google"
4. Configure:
   - User pool name: `snapspot-dev`
   - App client name: `snapspot-web-client`
   - Enable Hosted UI
5. Note your **User Pool ID** and **App Client ID**

### 1.2 Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to "APIs & Services" → "Credentials"
4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://YOUR-COGNITO-DOMAIN.auth.REGION.amazoncognito.com/oauth2/idpresponse`
5. Copy **Client ID** and **Client Secret**

### 1.3 Add Google to Cognito

1. In Cognito, go to "Federated identity providers"
2. Select "Google"
3. Paste Google **Client ID** and **Client Secret**
4. Set scopes: `profile email openid`
5. Map attributes:
   - Google `email` → User pool `email`
   - Google `name` → User pool `name`

### 1.4 Configure Hosted UI

1. In Cognito, go to "App integration" → Your app client
2. Edit Hosted UI settings:
   - Allowed callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed sign-out URLs: `http://localhost:3000`
   - OAuth 2.0 grant types: Authorization code grant
   - OAuth scopes: openid, email, profile
3. Note your **Cognito Domain** (e.g., `snapspot-dev.auth.us-east-1.amazoncognito.com`)

## Step 2: Project Setup (2 minutes)

```bash
# Clone or navigate to project
cd /Users/rashad/StudioProjects/Snapshot

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
```

## Step 3: Configure Environment (1 minute)

Edit `.env.local` with your Cognito values:

```bash
# Required: Update these values from Step 1
COGNITO_USER_POOL_ID="us-east-1_XXXXXXXXX"
COGNITO_CLIENT_ID="your-app-client-id"
COGNITO_DOMAIN="your-app-domain.auth.us-east-1.amazoncognito.com"
NEXT_PUBLIC_COGNITO_DOMAIN="your-app-domain.auth.us-east-1.amazoncognito.com"
COGNITO_ISSUER="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX"

# Generate a random secret for QR tokens
QR_TOKEN_SECRET="$(openssl rand -base64 32)"

# Leave these defaults for local development
DATABASE_URL="postgresql://snapspot:snapspot_dev_password@localhost:5432/snapspot_dev"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="snapspot-uploads"
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"
AWS_ENDPOINT_URL="http://localhost:4566"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
COGNITO_REDIRECT_URI="http://localhost:3000/api/auth/callback"
COGNITO_LOGOUT_URI="http://localhost:3000"
```

### Quick Secret Generation

```bash
# Generate QR_TOKEN_SECRET
openssl rand -base64 32
```

## Step 4: Start Services (1 minute)

```bash
# Start PostgreSQL and LocalStack
npm run docker:up

# Wait for services to be healthy (check logs)
docker-compose logs -f

# Press Ctrl+C when you see "ready to accept connections" from postgres
```

## Step 5: Database Setup (1 minute)

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed mock data (creates test users and jobs)
npm run db:seed
```

You should see:
```
🌱 Seeding database...
✅ Created 8 users
✅ Created 12 jobs
📊 Seed Summary: ...
🎉 Seeding complete!
🔑 Test QR Token: mock-token-open-job-12345 or short code: 123456
```

## Step 6: Run the App! 🚀

```bash
npm run dev
```

Visit: **http://localhost:3000**

## Test the Flow

### As a Requester:

1. Click "Sign in with Google"
2. Choose Google account
3. Select "Requester" role
4. View seeded jobs on dashboard
5. Click "Create Job" to add new job
6. Generate QR code for job

### As a Helper:

1. Sign in with different Google account (or use incognito)
2. Select "Helper" role
3. Use test QR code: `123456` (short code from seed data)
4. View job details
5. Test upload flow

## Verify Everything Works

```bash
# Run unit tests
npm test

# Run E2E tests (requires running dev server)
npm run test:e2e
```

## Common Issues

### "Cognito JWT verification failed"

- Check `COGNITO_ISSUER` matches format: `https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID`
- Verify `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` are correct

### "Database connection failed"

```bash
# Check PostgreSQL is running
docker-compose ps

# Restart services
npm run docker:down
npm run docker:up
```

### "S3 bucket not found"

```bash
# Check LocalStack logs
docker-compose logs localstack

# Recreate bucket manually
docker-compose exec localstack awslocal s3 mb s3://snapspot-uploads
```

### "OAuth redirect_uri mismatch"

- Verify Cognito callback URL is **exactly**: `http://localhost:3000/api/auth/callback`
- Check `.env.local` has `COGNITO_REDIRECT_URI="http://localhost:3000/api/auth/callback"`

## Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Run production build

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:seed          # Seed data
npm run db:reset         # Reset DB and reseed

# Docker
npm run docker:up        # Start services
npm run docker:down      # Stop services

# Testing
npm test                 # Run unit + component tests
npm run test:watch       # Watch mode
npm run test:e2e         # Run E2E tests
npm run test:all         # Run all tests

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run type-check       # TypeScript check
```

## Mock Users (from seed data)

### Requesters:
- sophia.requester@example.com
- emma.influencer@example.com
- olivia.brand@example.com
- ava.content@example.com

### Helpers:
- liam.helper@example.com
- noah.creator@example.com
- james.photo@example.com
- lucas.video@example.com

**Note:** These are mock database records. You'll sign in with your own Google account.

## Next Steps

1. **Explore the codebase:**
   - Start with `/src/app/api/auth/` for authentication flow
   - Check `/src/lib/auth/jwt.ts` for JWT verification
   - Review `/src/lib/qr/token.ts` for QR token logic

2. **Build remaining UI pages:**
   - See `README.md` section "Key Files Reference" for templates
   - Pages needed: landing, dashboard, job create/view, onboarding

3. **Add remaining API routes:**
   - `/api/jobs/[id]/qr` - Generate QR token
   - `/api/jobs/[id]/join` - Join via token
   - `/api/jobs/[id]/messages` - Messaging
   - `/api/jobs/[id]/uploads` - Upload management
   - `/api/uploads/presigned-url` - S3 upload URLs

4. **Write component tests:**
   - CreateJobForm
   - JobStatusPanel
   - QRCodeDisplay
   - UploadZone

5. **Complete E2E tests:**
   - Full requester flow
   - Full helper flow
   - QR code join flow

## Architecture Decisions

This POC follows these principles:

- ✅ **Mobile-first:** All UI optimized for phone screens
- ✅ **Server-side auth:** JWT verification in route handlers only
- ✅ **Pre-signed URLs:** No client-side S3 credentials
- ✅ **Role-based access:** Enforced server-side
- ✅ **Simple state:** Zustand for client state
- ✅ **Status FSM:** Validated job status transitions
- ✅ **QR security:** 15-min expiry, single-use tokens

## Production Readiness Notes

This is a **POC-quality** codebase. For production, you need:

1. Real payment integration (Stripe)
2. CloudFront for S3 assets
3. Rate limiting on APIs
4. Content moderation
5. Image optimization/thumbnails
6. Push notifications
7. Monitoring & logging
8. Load testing
9. CDN for Next.js static assets
10. Multi-region deployment

## Need Help?

1. Check `README.md` for detailed architecture
2. Review inline code comments
3. Check GitHub Issues (if applicable)
4. Review test files for usage examples

---

## Success Checklist

You're ready to proceed when:

- ✅ Docker services running (`docker-compose ps`)
- ✅ Database seeded (`npm run db:seed` completed)
- ✅ Dev server running (`npm run dev`)
- ✅ Can sign in with Google
- ✅ Can select role in onboarding
- ✅ Unit tests pass (`npm test`)

**Estimated total setup time: 10 minutes**

Happy coding! 🎉
