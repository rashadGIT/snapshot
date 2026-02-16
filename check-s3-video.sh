#!/bin/bash

# Script to check if a video exists in S3
# Usage: ./check-s3-video.sh <s3-key>

S3_KEY="$1"

if [ -z "$S3_KEY" ]; then
  echo "Usage: $0 <s3-key>"
  echo "Example: $0 jobs/abc123/video-1767544677095.webm"
  exit 1
fi

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

BUCKET="${AWS_S3_BUCKET:-${S3_BUCKET}}"
ENDPOINT="${AWS_ENDPOINT_URL:-${S3_ENDPOINT}}"

echo "Checking S3 bucket: $BUCKET"
echo "S3 Key: $S3_KEY"
echo "Endpoint: ${ENDPOINT:-AWS}"
echo ""

if [ -n "$ENDPOINT" ]; then
  # LocalStack
  echo "Using LocalStack endpoint: $ENDPOINT"
  aws --endpoint-url="$ENDPOINT" s3 ls "s3://$BUCKET/$S3_KEY" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ File EXISTS in LocalStack S3"
    echo ""
    echo "File metadata:"
    aws --endpoint-url="$ENDPOINT" s3api head-object \
      --bucket "$BUCKET" \
      --key "$S3_KEY" 2>&1 | grep -E "ContentType|ContentLength|LastModified"
  else
    echo ""
    echo "❌ File NOT FOUND in LocalStack S3"
    echo ""
    echo "Listing all files in bucket:"
    aws --endpoint-url="$ENDPOINT" s3 ls "s3://$BUCKET/" --recursive | grep video
  fi
else
  # Real AWS S3
  echo "Using AWS S3"
  aws s3 ls "s3://$BUCKET/$S3_KEY" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ File EXISTS in AWS S3"
    echo ""
    echo "File metadata:"
    aws s3api head-object \
      --bucket "$BUCKET" \
      --key "$S3_KEY" 2>&1 | grep -E "ContentType|ContentLength|LastModified"
  else
    echo ""
    echo "❌ File NOT FOUND in AWS S3"
    echo ""
    echo "Listing recent video files in bucket:"
    aws s3 ls "s3://$BUCKET/" --recursive | grep video | tail -20
  fi
fi
