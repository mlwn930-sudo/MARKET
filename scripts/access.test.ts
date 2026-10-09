/**
 * The door, pinned.
 *
 * This is the only security code in the project, and it exists for one
 * reason: the site is a public URL that answers 200 to anyone, and the
 * private build states conclusions. Before this, "private mode" would
 * have published investment opinions under the owner's name to whoever
 * found the address. The welcome screen was never a door — it reads
 * `sessionStorage` and has no credential.
 *
 * Two things here can fail silently and both are tested. A redirect
 * guard that misses a shape turns the login page into a phishing hop
 * that asks for the real password on the real domain. And a default
 * that locks on a missing variable locks the owner out of his own site,
 * at which point the pressure is to delete the lock rather than fix the
 * configuration.
 *
 *   npx tsx --test scripts/access.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ACCESS_COOKIE,
  accessToken,
  safeReturn,
  sameToken,
  sitePassword,
} from "../src/lib/access";

/* ── The return path ─────────────────────────────────────────────────── */

test("a path on this site is kept, with its query", () => {
  assert.equal(safeReturn("/chart-reader"), "/chart-reader");
  assert.equal(safeReturn("/company/BKNG?tab=chart"), "/company/BKNG?tab=chart");
  assert.equal(safeReturn("/"), "/");
});

test("every shape that leaves this site is refused", () => {
  for (const hostile of [
    "//evil.example/x", //  protocol-relative: a browser reads it as another host
    "https://evil.example/x",
    "http://evil.example",
    "evil.example",
    "/\\evil.example", // backslash, which some URL parsers treat as a slash
    "javascript:alert(1)",
    "  //evil.example", // leading space, so a naive startsWith("//") misses it
  ]) {
    assert.equal(safeReturn(hostile), "/", `${hostile} must not be followed`);
  }
});

test("nothing at all is the home page", () => {
  assert.equal(safeReturn(null), "/");
  assert.equal(safeReturn(undefined), "/");
  assert.equal(safeReturn(""), "/");
});

/* ── The token ───────────────────────────────────────────────────────── */

test("the cookie is a hash, never the password", async () => {
  const password = "a-password-that-should-not-appear";
  const token = await accessToken(password);
  assert.ok(!token.includes(password), "the credential is sitting in the jar");
  assert.match(token, /^[0-9a-f]{64}$/, "sha-256, hex");
});

test("the same password always gives the same token", async () => {
  /* The middleware derives it on every request and the route derived it
     once when the cookie was set. If this were not stable — a random
     salt, a timestamp — every visitor would be logged out on their next
     page load and the bug would look like a cookie problem. */
  assert.equal(await accessToken("x"), await accessToken("x"));
  assert.notEqual(await accessToken("x"), await accessToken("y"));
});

test("token comparison rejects a different length and a different value", () => {
  assert.equal(sameToken("abc", "abc"), true);
  assert.equal(sameToken("abc", "abd"), false);
  assert.equal(sameToken("abc", "ab"), false);
  assert.equal(sameToken("", ""), true);
});

/* ── The default ─────────────────────────────────────────────────────── */

test("no password configured means the site is open, not locked shut", () => {
  /* Deliberately this way round. A site that locks itself on an unset
     variable locks its owner out on the day he forgets to set it, and
     the fix under that pressure is to remove the lock. */
  const before = process.env.SITE_PASSWORD;
  try {
    delete process.env.SITE_PASSWORD;
    assert.equal(sitePassword(), null);
    process.env.SITE_PASSWORD = "   ";
    assert.equal(sitePassword(), null, "whitespace is not a password");
    process.env.SITE_PASSWORD = "  real  ";
    assert.equal(sitePassword(), "real", "trimmed, so a stray space cannot lock him out");
  } finally {
    if (before === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = before;
  }
});

test("the password is not a NEXT_PUBLIC_ variable", () => {
  /* A password inlined into the client bundle is not a password. */
  const source = readFileSync("src/lib/access.ts", "utf8");
  assert.ok(
    !/NEXT_PUBLIC_[A-Z_]*PASSWORD/.test(source),
    "the password must never be inlined into the browser bundle",
  );
  assert.equal(ACCESS_COOKIE, "mi_access");
});

test("the middleware gates the pages and leaves the door and the email links open", () => {
  /* The matcher is a build-time constant, so a mistake in it cannot be
     caught at runtime by anything except noticing a page is reachable.
     This reads the literal. */
  const source = readFileSync("src/middleware.ts", "utf8");

  for (const open of ["unlock", "api/unlock", "api/alerts/unsubscribe", "api/alerts/decide"]) {
    assert.ok(source.includes(open), `${open} must stay reachable`);
  }
  /* The rendered previews are pictures of the content behind the lock. */
  assert.ok(
    !/\|opengraph-image\|/.test(source),
    "opengraph images must be gated with everything else",
  );
  assert.ok(
    source.includes("/api/") && source.includes("401"),
    "an API call must get a status, not a redirect to a login form",
  );
});
