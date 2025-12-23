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
  basePath: process.env.NEXT_BASE_PATH || '/archive',
  assetPrefix: process.env.NEXT_BASE_PATH || '/archive',
  trailingSlash: true,
  output: "export",
}

export default nextConfig
