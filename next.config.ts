import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Financial data is fetched server-side so API keys never reach the browser.
  // Only values that are safe to expose belong in NEXT_PUBLIC_*.
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
