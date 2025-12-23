/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
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
  const BASE_PATH = process.env.NEXT_BASE_PATH || ''
  const ASSET_PREFIX = BASE_PATH || ''
  basePath: BASE_PATH || undefined,
  assetPrefix: ASSET_PREFIX || undefined,
  trailingSlash: true,
  output: "standalone",
}

export { BASE_PATH as nextBasePath }

export default nextConfig
