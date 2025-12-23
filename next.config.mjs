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
  basePath: process.env.NEXT_BASE_PATH || undefined,
  assetPrefix: process.env.NEXT_BASE_PATH || undefined,
  trailingSlash: true,
  output: "standalone",
}

export { BASE_PATH as nextBasePath }

export default nextConfig
