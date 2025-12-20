#!/bin/bash
set -e

echo "🚀 Setting up local development environment..."
echo ""

# Start Docker containers
echo "1️⃣  Starting Docker containers (PostgreSQL + LocalStack)..."
docker-compose up -d

# Wait for LocalStack to be ready
echo "2️⃣  Waiting for LocalStack to be ready..."
sleep 5

# Check if bucket exists, create if not
echo "3️⃣  Creating S3 bucket in LocalStack..."
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_ENDPOINT_URL=http://localhost:4566 \
  aws s3 mb s3://snapspot-uploads --region us-east-1 2>/dev/null || echo "  ℹ️  Bucket already exists"

# Configure CORS
echo "4️⃣  Configuring CORS..."
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

# Run database migrations
echo "5️⃣  Running database migrations..."
npx prisma db push

echo ""
echo "✅ Local development environment is ready!"
echo ""
echo "📝 Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - LocalStack S3: localhost:4566"
echo "  - S3 Bucket: snapspot-uploads"
echo ""
echo "🎯 Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Open: http://localhost:3000"
echo ""
