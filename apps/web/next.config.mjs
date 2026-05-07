/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  env: {
    AGENTREADY_API_URL: process.env.AGENTREADY_API_URL ?? "http://localhost:8000",
  },
  // We rsync to a deploy host where filesystem isn't writable for some traces.
  output: "standalone",
};

export default nextConfig;
