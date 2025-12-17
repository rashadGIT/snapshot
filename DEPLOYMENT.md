# Deployment Guide - Snapspot

This guide covers deploying Snapspot to AWS with GitHub Actions CI/CD.

## Prerequisites

- GitHub repository with the code
- AWS account with appropriate permissions
- PostgreSQL database (AWS RDS recommended)
- S3 bucket for file storage

## Architecture Overview

```
GitHub → GitHub Actions → AWS Amplify (or ECS)
                       ↓
                  AWS RDS (PostgreSQL)
                       ↓
                  AWS S3 (File Storage)
```

## Setup Steps

### 1. Set Up AWS Infrastructure

#### Option A: AWS RDS (PostgreSQL Database)

1. **Create RDS PostgreSQL Instance:**
   ```bash
   # Via AWS Console:
   # - Go to RDS → Create Database
   # - Choose PostgreSQL 16
   # - Template: Production (or Dev/Test for staging)
   # - Instance: db.t3.micro (free tier) or larger
   # - Username: snapspot
   # - Auto-generate password (save it!)
   # - Public access: Yes (for GitHub Actions) or use VPC
   # - Create database
   ```

2. **Security Group:**
   - Add inbound rule for PostgreSQL (port 5432)
   - Source: Your IP + GitHub Actions IPs (or 0.0.0.0/0 temporarily)

3. **Get connection string:**
   ```
   postgresql://snapspot:PASSWORD@your-instance.region.rds.amazonaws.com:5432/snapspot
   ```

#### Option B: AWS S3 (File Storage)

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://snapspot-uploads-prod --region us-east-1
   ```

2. **Configure CORS:**
   ```bash
   # Create cors.json:
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["https://your-domain.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]

   aws s3api put-bucket-cors --bucket snapspot-uploads-prod --cors-configuration file://cors.json
   ```

3. **Create IAM User for GitHub Actions:**
   ```bash
   # Via AWS Console:
   # - IAM → Users → Create User
   # - Attach policies: AmazonS3FullAccess
   # - Create access keys (save them!)
   ```

### 2. Choose Deployment Platform

#### Option A: AWS Amplify (Recommended for Next.js)

**Pros:** Automatic deployments, CDN, SSL, easy setup
**Cons:** Less control than ECS

1. **Connect Repository:**
   - Go to AWS Amplify Console
   - New App → Host web app
   - Connect GitHub repository
   - Branch: main/master

2. **Build Settings:**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
           - npx prisma generate
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **Environment Variables:**
   Add in Amplify Console → Environment variables:
   - `DATABASE_URL`
   - `AWS_S3_BUCKET`
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

#### Option B: AWS ECS with Docker

**Pros:** Full control, scalable
**Cons:** More complex setup

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:20-alpine AS base

   # Dependencies
   FROM base AS deps
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci

   # Builder
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npx prisma generate
   RUN npm run build

   # Runner
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production

   COPY --from=builder /app/public ./public
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static

   EXPOSE 3000
   ENV PORT 3000
   CMD ["node", "server.js"]
   ```

2. **Create ECS Cluster, Task Definition, and Service**
   (See AWS ECS documentation for detailed steps)

### 3. Configure GitHub Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

Add these secrets:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_ACCESS_KEY_ID` - IAM user access key
- `AWS_SECRET_ACCESS_KEY` - IAM user secret key
- `AWS_REGION` - e.g., `us-east-1`
- `AWS_S3_BUCKET` - Your S3 bucket name
- `NEXT_PUBLIC_APP_URL` - Your production URL

**For Amplify:**
- `AMPLIFY_APP_ID` - From Amplify Console

**For ECS (if using):**
- `ECR_REPOSITORY` - ECR repository name
- `ECS_CLUSTER` - ECS cluster name
- `ECS_SERVICE` - ECS service name

### 4. Test the Pipeline

1. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Add CI/CD pipeline"
   git push origin main
   ```

2. **Watch GitHub Actions:**
   - Go to GitHub → Actions tab
   - CI workflow runs on all pushes
   - Deploy workflow runs only on main branch

3. **Verify deployment:**
   - Check AWS Amplify Console (or ECS)
   - Visit your production URL
   - Test database connectivity
   - Test file upload

### 5. Database Migrations

The pipeline automatically runs `prisma db push` on deployment.

For production, consider using migrations instead:

```bash
# Generate migration locally
npx prisma migrate dev --name init

# Update deploy workflow to use:
npx prisma migrate deploy
```

### 6. Monitoring & Logs

**AWS Amplify:**
- Logs: Amplify Console → Your App → Monitoring

**AWS ECS:**
- CloudWatch Logs: ECS → Task → Logs tab

**Database:**
- RDS: CloudWatch → RDS metrics

### 7. Custom Domain (Optional)

**For Amplify:**
1. Amplify Console → Domain management
2. Add custom domain
3. AWS handles SSL certificate via ACM

**For ECS:**
1. Create Application Load Balancer
2. Configure Route 53 for DNS
3. Add ACM certificate for SSL

## Environment-Specific Deployments

### Staging Environment

1. Create `develop` branch
2. Duplicate workflows for staging
3. Use separate AWS resources (staging DB, S3 bucket)

### Pull Request Previews

Add to `.github/workflows/preview.yml`:
```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

## Rollback Strategy

**Amplify:**
- Amplify Console → Deployment history → Redeploy previous version

**ECS:**
```bash
aws ecs update-service --cluster snapspot-cluster --service snapspot-service --task-definition snapspot:PREVIOUS_VERSION
```

**Database:**
- Keep regular RDS snapshots
- Restore from snapshot if needed

## Cost Optimization

- Use AWS Free Tier where possible
- RDS: db.t3.micro ($15-30/month)
- S3: Pay per use (~$0.023/GB)
- Amplify: ~$15/month for hosting
- Set up billing alerts!

## Security Checklist

- ✅ Use environment variables for secrets
- ✅ Enable RDS encryption at rest
- ✅ Enable S3 bucket encryption
- ✅ Use HTTPS only (SSL certificate)
- ✅ Restrict database access to application only
- ✅ Use IAM roles with minimum permissions
- ✅ Enable CloudWatch logging
- ✅ Regular security updates via Dependabot

## Troubleshooting

**Build fails:**
- Check GitHub Actions logs
- Verify environment variables are set
- Test build locally: `npm run build`

**Database connection fails:**
- Verify DATABASE_URL is correct
- Check RDS security group allows inbound
- Confirm database is running

**File uploads fail:**
- Verify S3 bucket exists
- Check IAM permissions
- Verify CORS configuration

## Next Steps

1. Set up monitoring alerts (CloudWatch)
2. Configure auto-scaling (if using ECS)
3. Set up staging environment
4. Enable CloudFront CDN for better performance
5. Implement blue-green deployments

## Support

For issues, check:
- GitHub Actions logs
- AWS CloudWatch logs
- RDS connection status
- S3 bucket permissions
