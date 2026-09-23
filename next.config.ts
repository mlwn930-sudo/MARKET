import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Financial data is fetched server-side so API keys never reach the browser.
  // Only values that are safe to expose belong in NEXT_PUBLIC_*.

  /**
   * Ship the content files into the serverless bundle.
   *
   * This is not an optimisation — without it the deployed site is broken in a
   * way that does not show up locally or in the build log.
   *
   * The news feed, the screener universe and the 13F holdings are all read at
   * runtime with `readFile(join(process.cwd(), somePath))`. Next's file tracer
   * works by reading the source, and it cannot see through a path held in a
   * variable, so it concludes those files are not needed and leaves them out.
   *
   * The first render still works, because it happens at build time where the
   * whole repository is present. Then the page revalidates, the re-render runs
   * inside a lambda that has no content directory, every store falls back to
   * its empty value, and the site quietly reports that the feed was never
   * populated. Locally it never reproduces.
   */
  outputFileTracingIncludes: {
    "/**": [
      "./content/news/**",
      "./content/fundamentals/**",
      "./content/institutional/**",
      "./content/analysis/**",
    ],
  },

  experimental: {
    optimizePackageImports: ["recharts", "lightweight-charts"],
  },
};

export default nextConfig;
