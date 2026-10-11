/**
 * The door to the site, for as long as it is one person's.
 *
 * The site already had a welcome screen and it was never a door: it
 * reads `sessionStorage`, has no credential, and anybody who clicks
 * through sees everything. That was fine while every page described
 * measurements. It stopped being fine the moment the private build
 * started stating conclusions, because the deployment is a public URL
 * that answers 200 to anyone — so "private mode" would have published
 * investment opinions under the owner's name to whoever found the
 * address.
 *
 * So this is a real credential, and it is deliberately the smallest one
 * that is actually a credential: a shared password, compared on the
 * server, exchanged for an HttpOnly cookie. No accounts, no database, no
 * third-party service, nothing to pay for.
 *
 * WHAT IT IS NOT. It is not multi-user, it is not a login, and it does
 * not identify anybody. One password that the owner knows, and a cookie
 * that proves it was entered. If the site ever has more than one reader
 * with different rights, this is the wrong thing and should be replaced
 * rather than extended.
 *
 * WEB CRYPTO ONLY. This module is imported by `middleware.ts`, which
 * runs on the Edge runtime where `node:crypto` does not exist. Every
 * function here uses `crypto.subtle`, which is present on both the Edge
 * and in Node, so the same token derivation runs in the middleware and
 * in the route that sets the cookie — and they cannot drift.
 */

/** HttpOnly, so a script on the page cannot read it, and so an XSS on
 *  any one page does not hand over the whole site. */
export const ACCESS_COOKIE = "mi_access";

/** Long enough that the owner is not retyping it, short enough that a
 *  borrowed laptop does not stay open for a year. */
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * The cookie value for a password.
 *
 * A hash rather than the password itself, so the cookie is not a copy of
 * the credential sitting in a jar where anything that can read cookies
 * can take it and reuse it elsewhere. The salt is fixed and public —
 * it is here to stop a rainbow table of common passwords, not to be a
 * secret of its own.
 */
export async function accessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`market-intel:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare without leaking the answer in the timing.
 *
 * Both sides here are hex digests of fixed length, so this is close to
 * ceremony — but a comparison that returns early on the first wrong
 * character is the kind of thing that gets copied into a place where it
 * matters, and the cost of doing it properly is four lines.
 */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The password the site is locked with, or null when it is open.
 *
 * NO PASSWORD MEANS NO DOOR, which is the behaviour the site has today
 * and therefore the safe default for a deployment nobody has configured
 * yet. The dangerous default would be the other way round: a site that
 * locks itself on an unset variable is a site that locks its owner out
 * on the day he forgets to set it, and the pressure then is to remove
 * the lock rather than to fix the configuration.
 *
 * It is NOT `NEXT_PUBLIC_`. A password inlined into the client bundle is
 * not a password.
 */
/**
 * How many wrong passwords an address gets before it waits.
 *
 * The door had no limit at all. With the generated passphrase that is
 * academic — twenty-five characters is not guessable — but the owner
 * can change it to something he will remember, and a memorable
 * password against an endpoint that answers as fast as it can is
 * minutes of work for anyone who tries.
 *
 * WHAT THIS DOES NOT DO, said plainly because an overstated defence is
 * worse than none: the counter lives in one serverless instance's
 * memory. A platform running several instances gives an attacker one
 * allowance per instance, and a cold start resets it. It is a speed
 * bump, not a lock.
 *
 * The delay below is the part that holds regardless. Every failure
 * waits, on the server, before answering — so a single connection can
 * try roughly one password a second however many instances exist, and
 * no amount of parallelism makes any single attempt faster.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const FAILURE_DELAY_MS = 1000;

const attempts = new Map<string, { count: number; first: number }>();

/** Records a failure and says whether this caller should be refused
 *  outright. Call it only on a wrong password: a correct one must not
 *  be able to fill anybody's allowance. */
export function tooManyAttempts(who: string): boolean {
  const now = Date.now();
  const seen = attempts.get(who);

  if (!seen || now - seen.first > WINDOW_MS) {
    attempts.set(who, { count: 1, first: now });
    return false;
  }

  seen.count++;

  /* Bounded, so a flood of distinct addresses cannot grow the map
     until the instance runs out of memory — which would turn a
     brute-force defence into a denial of service against the owner. */
  if (attempts.size > 5000) {
    for (const [key, value] of attempts) {
      if (now - value.first > WINDOW_MS) attempts.delete(key);
    }
  }

  return seen.count > MAX_ATTEMPTS;
}

/** Clears the allowance once the password is right, so a mistyped
 *  password earlier in the day does not lock the owner out after he
 *  gets it right. */
export function clearAttempts(who: string): void {
  attempts.delete(who);
}

/** The wait every failure pays. Awaited before answering, so the cost
 *  is the attacker's and not the owner's. */
export const failureDelay = () =>
  new Promise<void>((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));

export function sitePassword(): string | null {
  const value = process.env.SITE_PASSWORD?.trim();
  return value ? value : null;
}

/**
 * Where to send the visitor after the door opens.
 *
 * Only a path on this site. Without this the `from` parameter is an
 * open redirect: a link that looks like the owner's own address, asks
 * for his password, and lands him somewhere else the moment he types
 * it. Three shapes have to be refused, and the second is the one that
 * gets missed — `//evil.example/x` is protocol-relative, so a browser
 * reads it as another host even though it starts with a slash.
 */
export function safeReturn(raw: string | null | undefined): string {
  if (!raw) return "/";
  const value = raw.trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  /* A backslash is a slash to some browsers' URL parsers. */
  if (value.startsWith("/\\")) return "/";
  return value;
}
