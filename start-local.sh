#!/bin/bash
set -e

echo "🚀 Starting Snapspot Local Development Environment"
echo "=================================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Error: Docker is not installed"
  echo "   Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
  exit 1
fi

# Check if Docker is running
echo "🐳 Checking Docker status..."
if ! docker info &> /dev/null; then
  echo "⚠️  Docker is not running. Starting Docker Desktop..."
  open -a Docker

  echo "   Waiting for Docker to start..."
  # Wait for Docker daemon to be ready (max 60 seconds)
  counter=0
  while ! docker info &> /dev/null; do
    if [ $counter -ge 60 ]; then
      echo "❌ Error: Docker failed to start within 60 seconds"
      echo "   Please start Docker Desktop manually and try again"
      exit 1
    fi
    echo -n "."
    sleep 2
    counter=$((counter + 2))
  done
  echo ""
  echo "✅ Docker is now running!"
else
  echo "✅ Docker is already running"
fi
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "⚠️  Warning: .env.local not found"
  echo "   Checking for .env file..."
  if [ ! -f .env ]; then
    echo "❌ Error: No environment file found (.env or .env.local)"
    echo "   Please copy .env.local.example to .env.local and configure it"
    exit 1
  else
    echo "✅ Found .env file"
  fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "1️⃣  Installing npm dependencies..."
  npm install
  echo ""
else
  echo "✅ Dependencies already installed"
  echo ""
fi

# Start Docker containers
echo "2️⃣  Starting Docker containers (PostgreSQL + LocalStack)..."
docker-compose up -d
echo ""

# Wait for services to be ready
echo "3️⃣  Waiting for services to be ready..."
sleep 5
echo ""

# Create S3 bucket
echo "4️⃣  Setting up LocalStack S3 bucket..."
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_ENDPOINT_URL=http://localhost:4566 \
  aws s3 mb s3://snapspot-uploads --region us-east-1 2>/dev/null || echo "  ℹ️  Bucket already exists"
echo ""

# Configure CORS
echo "5️⃣  Configuring S3 CORS..."
cat > /tmp/cors-local.json <<'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["http://localhost:3000"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_ENDPOINT_URL=http://localhost:4566 \
  aws s3api put-bucket-cors --bucket snapspot-uploads --cors-configuration file:///tmp/cors-local.json
echo ""

# Generate Prisma client
echo "6️⃣  Generating Prisma client..."
npx prisma generate
echo ""

# Push database schema
echo "7️⃣  Pushing database schema..."
npx prisma db push
echo ""

# Seed database
echo "8️⃣  Seeding database with test data..."
npx tsx prisma/seed.ts
echo ""

echo "=================================================="
echo "✅ Environment Setup Complete!"
echo "=================================================="
echo ""
echo "📝 Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - LocalStack S3: localhost:4566"
echo "  - S3 Bucket: snapspot-uploads"
echo ""
echo "🌐 Starting development server..."
echo "   The app will be available at: http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

# Start development server
npm run dev
