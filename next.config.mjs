/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'hooks', 'services'],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.zaco.sa",
      },
    ],
    unoptimized: true,
  },
  basePath: process.env.NEXT_BASE_PATH || '/archive',
  assetPrefix: process.env.NEXT_BASE_PATH || '/archive',
  trailingSlash: true,
  output: "export",
  
  // Add cache control headers for deployment updates
  headers: async () => {
    return [
      {
        // HTML files: no cache, always fetch fresh
        source: '/:path*.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      },
      {
        // Metadata and manifests: short cache
        source: '/:path*(manifest|robots|sitemap).:ext',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600' // 1 hour
          }
        ]
      },
      {
        // JS/CSS chunks: cache with version control
        source: '/:path*(_next/static/:file*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable' // 1 year (safe because Next.js adds hash)
          }
        ]
      },
      {
        // API calls: no cache
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, no-cache, no-store, must-revalidate, max-age=0'
          }
        ]
      },
      {
        // Default: short cache for everything else
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300' // 5 minutes
          }
        ]
      }
    ]
  }
}

export default nextConfig
