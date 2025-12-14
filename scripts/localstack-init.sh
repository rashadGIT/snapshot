#!/bin/bash
# LocalStack S3 bucket initialization script

echo "Creating S3 bucket for Snapspot uploads..."

awslocal s3 mb s3://snapspot-uploads --region us-east-1

echo "Configuring CORS for local development..."

awslocal s3api put-bucket-cors --bucket snapspot-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "S3 bucket 'snapspot-uploads' created successfully!"
