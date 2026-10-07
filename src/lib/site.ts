/**
 * Where this site lives, when nothing is there to ask.
 *
 * Most of the code that needs an absolute URL has a `Request` in hand and
 * can read the host that served it — which is the better answer, because
 * it is right on localhost, on a preview deployment and in production
 * without anyone configuring anything. `src/app/api/alerts/*` does exactly
 * that.
 *
 * Metadata has no request. `metadataBase`, an Open Graph card and a
 * canonical link are computed while the page is being generated, and they
 * still have to produce an absolute URL, because a relative `og:image` is
 * simply dropped by every service that reads one. So this resolves the
 * origin from the environment instead, in the order of how much each
 * source actually knows:
 *
 *   NEXT_PUBLIC_SITE_URL          what somebody deliberately set
 *   VERCEL_PROJECT_PRODUCTION_URL the project's stable production host
 *   VERCEL_URL                    this particular deployment
 *   localhost                     development
 *
 * The production host beats the deployment host on purpose. `VERCEL_URL`
 * is unique per deployment, so a card built from it would point a share
 * made today at a build that will be replaced tomorrow — the link keeps
 * working, but it stops being the site and starts being an archive of one
 * afternoon.
 */

const FALLBACK = "http://localhost:3000";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return withScheme(configured);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return withScheme(production);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return withScheme(deployment);

  return FALLBACK;
}

/** Vercel's host variables arrive without a scheme; a configured value may
 *  arrive with one. Both have to come out the same. */
function withScheme(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
