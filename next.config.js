/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'], // Add S3/CloudFront domains in production
  },
  // Enable experimental features if needed
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // For large uploads
    },
  },
};

module.exports = nextConfig;
