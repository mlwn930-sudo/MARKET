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
      // Read at runtime by lib/watch-store.ts, through a path the tracer
      // cannot follow — the exact failure the note above describes, and it
      // would have shipped a deployed site whose scanner panel was
      // permanently empty while working perfectly in development.
      "./content/watch/**",
      "./content/companies/**",
    ],
  },

  experimental: {
    optimizePackageImports: ["recharts", "lightweight-charts"],
  },

  /**
   * Security headers.
   *
   * There were none. For a site that now takes an email address at the
   * door, that is the gap worth closing first — not because this project
   * is a likely target, but because every one of these is a single line
   * and the absence of each is a real, named weakness.
   *
   * Notes on the two judgement calls:
   *
   * script-src keeps 'unsafe-inline'. Next's own bootstrap is inline, and
   * so is the one blocking script in the layout that decides whether the
   * welcome gate has already been passed. Removing it needs per-request
   * nonces, which cannot be done from a static header and would mean
   * giving up static rendering on every page. What the directive still
   * buys is the part that matters most here: no script from another
   * origin can execute, so an injected <script src="evil"> is dead.
   *
   * img-src names static2.finnhub.io because that is where company logos
   * are fetched from — deliberately not re-served from this domain, so
   * the browser goes there directly and the policy has to say so.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // A wildcard across finnhub.io, not the one host the stored URLs
      // name. The logo map holds static2 addresses and the CDN redirects
      // them to static9 — and CSP is enforced against the redirect TARGET,
      // so naming the stored host alone blocked every logo on the site.
      // Found only because the policy reported it; without the header this
      // would have been a silent production break.
      "img-src 'self' data: blob: https://*.finnhub.io",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Clickjacking. frame-ancestors above is the modern form; this is
          // the one older browsers still read.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser guessing that an uploaded file is HTML and
          // running it.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // A company page URL names the company someone is researching.
          // That should not travel to another site in a Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs a camera, a microphone or a location, so
          // nothing here may ask.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Two years, subdomains included. Only meaningful once served
          // over HTTPS, which the deployment is and localhost is not —
          // browsers ignore it there.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        // The alert endpoints handle an address. Nothing about them should
        // ever be cached by a browser, a CDN or a shared proxy.
        source: "/api/alerts/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
