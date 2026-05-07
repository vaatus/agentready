/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // AGENTREADY_API_URL is read at runtime from process.env in lib/api.ts
  // (server components only — never exposed to the client bundle).
};

export default nextConfig;
