#!/bin/bash
set -e

# Unset LocalStack endpoint if present
unset AWS_ENDPOINT_URL

echo "🚀 Setting up AWS resources for Snapspot..."
echo ""

# Configuration
PROJECT_NAME="snapspot"
REGION="us-east-1"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "📋 Configuration:"
echo "  Project: $PROJECT_NAME"
echo "  Region: $REGION"
echo "  Generated DB Password: $DB_PASSWORD"
echo ""

# 1. Create S3 Bucket
echo "1️⃣  Creating S3 bucket..."
BUCKET_NAME="${PROJECT_NAME}-uploads-prod"
aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || echo "  ℹ️  Bucket already exists"

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Configure CORS
cat > /tmp/cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file:///tmp/cors.json
echo "  ✅ S3 bucket created: $BUCKET_NAME"
echo ""

# 2. Create RDS PostgreSQL Database
echo "2️⃣  Creating RDS PostgreSQL database..."
echo "  ⏳ This takes ~5-10 minutes..."

DB_INSTANCE_ID="${PROJECT_NAME}-db"

# Create DB instance
aws rds create-db-instance \
  --db-instance-identifier $DB_INSTANCE_ID \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username snapspot \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --publicly-accessible \
  --no-multi-az \
  --region $REGION \
  --tags Key=Project,Value=$PROJECT_NAME 2>/dev/null || echo "  ℹ️  Database already exists"

# Wait for database to be available
echo "  ⏳ Waiting for database to become available..."
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID --region $REGION

# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE_ID \
  --region $REGION \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "  ✅ Database created: $DB_ENDPOINT"
echo ""

# 3. Create IAM User for GitHub Actions
echo "3️⃣  Creating IAM user for GitHub Actions..."
IAM_USER="${PROJECT_NAME}-github-actions"

aws iam create-user --user-name $IAM_USER 2>/dev/null || echo "  ℹ️  User already exists"

# Attach policies
aws iam attach-user-policy \
  --user-name $IAM_USER \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Create access keys
ACCESS_KEYS=$(aws iam create-access-key --user-name $IAM_USER --output json 2>/dev/null || echo '{"AccessKey": {"AccessKeyId": "EXISTING", "SecretAccessKey": "EXISTING"}}')

AWS_ACCESS_KEY=$(echo $ACCESS_KEYS | jq -r '.AccessKey.AccessKeyId')
AWS_SECRET_KEY=$(echo $ACCESS_KEYS | jq -r '.AccessKey.SecretAccessKey')

echo "  ✅ IAM user created: $IAM_USER"
echo ""

# 4. Save credentials
echo "4️⃣  Saving credentials..."
cat > aws-credentials.txt <<EOF
===========================================
AWS CREDENTIALS - SAVE THESE SECURELY!
===========================================

DATABASE_URL=postgresql://snapspot:$DB_PASSWORD@$DB_ENDPOINT:5432/postgres

AWS_REGION=$REGION
AWS_S3_BUCKET=$BUCKET_NAME
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_KEY

NEXT_PUBLIC_APP_URL=https://your-domain.com  # Update this later

===========================================
GITHUB SECRETS TO ADD:
===========================================
Go to: https://github.com/rashadGIT/snapshot/settings/secrets/actions

Add these secrets:
1. DATABASE_URL
2. AWS_REGION
3. AWS_S3_BUCKET
4. AWS_ACCESS_KEY_ID
5. AWS_SECRET_ACCESS_KEY
6. NEXT_PUBLIC_APP_URL

===========================================
EOF

echo "  ✅ Credentials saved to: aws-credentials.txt"
echo ""

# 5. Update RDS Security Group
echo "5️⃣  Configuring database security group..."
DB_SECURITY_GROUP=$(aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE_ID \
  --region $REGION \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Allow access from anywhere (for GitHub Actions)
# In production, restrict this to your IP ranges
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SECURITY_GROUP \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region $REGION 2>/dev/null || echo "  ℹ️  Security group rule already exists"

echo "  ✅ Security group configured"
echo ""

echo "✅ AWS setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Review credentials in: aws-credentials.txt"
echo "2. Add secrets to GitHub: https://github.com/rashadGIT/snapshot/settings/secrets/actions"
echo "3. Push code to trigger deployment"
echo ""
echo "⚠️  IMPORTANT: Keep aws-credentials.txt secure and delete after adding to GitHub!"
