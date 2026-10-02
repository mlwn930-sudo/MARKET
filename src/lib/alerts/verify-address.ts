import { promises as dns } from "node:dns";

/**
 * Is this a real address, before anything is sent to it.
 *
 * There are two different questions people mean by "verify an email", and
 * conflating them is how sign-up flows end up either useless or unusable:
 *
 *   1. Is this a real, reachable address — a domain that exists and
 *      accepts mail, not a typo and not a throwaway.
 *   2. Does the person typing it own it.
 *
 * This file answers the first. It needs no key, no network account and no
 * round trip through the person's inbox, so it works today and it works
 * for every visitor. The second needs a code delivered to the address, and
 * lives in codes.ts.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: connect to the mail server and probe
 * whether the mailbox exists (SMTP VRFY / RCPT). It is unreliable — most
 * serious providers accept every recipient at that stage and reject later
 * — it gets the prober's IP listed as a spam source, and on a serverless
 * host the outbound port is usually closed anyway. A check that is wrong
 * and also gets you blocked is worse than no check.
 */

export type AddressVerdict =
  | { ok: true; email: string }
  | {
      ok: false;
      /** For the interface to decide what to say. */
      reason: "shape" | "disposable" | "no-domain" | "no-mail";
      message: string;
      /** A corrected address, when the problem is an obvious typo. */
      suggestion?: string;
    };

/**
 * Throwaway inbox providers.
 *
 * The point of the list is not to be exhaustive — it cannot be, new ones
 * appear weekly — it is to stop the casual case where someone pastes a
 * ten-minute address to get past a form. Anyone determined enough to find
 * a domain not on this list is someone who wanted in badly enough that the
 * owner's approval step is the right place to stop them.
 */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "maildrop.cc", "dispostable.com",
  "fakeinbox.com", "mailnesia.com", "tempr.email", "discard.email",
  "mintemail.com", "spamgourmet.com", "mailcatch.com", "moakt.com",
  "emailondeck.com", "tempmailo.com", "burnermail.io", "mohmal.com",
  "inboxkitten.com", "harakirimail.com", "spam4.me", "grr.la",
]);

/**
 * The domains a typo is most likely to be aiming at.
 *
 * Only the handful that cover almost every real case. A general-purpose
 * spell-checker over all domains would start "correcting" company mail
 * servers that are spelled exactly right, which is a worse failure than
 * missing a typo — it tells someone their own address is wrong.
 */
const COMMON = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "walla.co.il", "walla.com", "012.net.il", "bezeqint.net",
];

/** Edit distance, capped: anything more than two edits away is a different
 *  domain rather than a misspelling of this one. */
function withinTwoEdits(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length] <= 2;
}

function typoSuggestion(domain: string): string | null {
  if (COMMON.includes(domain)) return null;
  for (const candidate of COMMON) {
    if (withinTwoEdits(domain, candidate)) return candidate;
  }
  return null;
}

/**
 * Does the domain actually accept mail.
 *
 * An MX record is the real test. A domain with none can still receive mail
 * at its A record by an old fallback rule, so that is checked second
 * rather than treated as a failure — refusing a small domain that is
 * configured the old-fashioned way would reject a real person.
 */
async function acceptsMail(domain: string): Promise<"yes" | "no-mail" | "no-domain"> {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0 && mx.some((r) => r.exchange?.length > 0)) return "yes";
  } catch {
    /* Falls through: no MX is not yet an answer. */
  }
  try {
    const a = await dns.resolve4(domain);
    if (a.length > 0) return "yes";
  } catch {
    /* Nor is no A record, on its own. */
  }
  try {
    await dns.resolveAny(domain);
    /* The domain resolves to something but takes no mail. */
    return "no-mail";
  } catch {
    return "no-domain";
  }
}

export async function verifyAddress(raw: string): Promise<AddressVerdict> {
  const email = raw.trim().toLowerCase();

  if (
    email.length < 6 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  ) {
    return {
      ok: false,
      reason: "shape",
      message: "הכתובת לא נראית תקינה. בדקו שוב.",
    };
  }

  const domain = email.slice(email.lastIndexOf("@") + 1);

  if (DISPOSABLE.has(domain)) {
    return {
      ok: false,
      reason: "disposable",
      message: "כתובת זמנית לא תתאים כאן — ההתראות נשלחות לאורך זמן.",
    };
  }

  const suggestion = typoSuggestion(domain);

  /* A DNS lookup that hangs must not hold the door shut. Two seconds is
     far longer than a resolver needs and short enough that nobody waits. */
  let accepts: Awaited<ReturnType<typeof acceptsMail>>;
  try {
    accepts = await Promise.race([
      acceptsMail(domain),
      new Promise<"yes">((resolve) => setTimeout(() => resolve("yes"), 2000)),
    ]);
  } catch {
    /* A resolver failure is this project's problem, not the visitor's. */
    accepts = "yes";
  }

  if (accepts === "no-domain") {
    return {
      ok: false,
      reason: "no-domain",
      message: suggestion
        ? `הדומיין ${domain} לא קיים. התכוונתם ל-${suggestion}?`
        : `הדומיין ${domain} לא קיים.`,
      ...(suggestion
        ? { suggestion: `${email.slice(0, email.lastIndexOf("@"))}@${suggestion}` }
        : {}),
    };
  }

  if (accepts === "no-mail") {
    return {
      ok: false,
      reason: "no-mail",
      message: `הדומיין ${domain} לא מקבל דואר.`,
      ...(suggestion
        ? { suggestion: `${email.slice(0, email.lastIndexOf("@"))}@${suggestion}` }
        : {}),
    };
  }

  /* The domain is real and takes mail. A likely typo in a REAL domain is
     reported too — "gmial.com" exists and accepts mail, which is exactly
     why a reachability check alone does not catch the commonest mistake
     anybody makes typing their own address. */
  if (suggestion) {
    return {
      ok: false,
      reason: "shape",
      message: `התכוונתם ל-${suggestion}?`,
      suggestion: `${email.slice(0, email.lastIndexOf("@"))}@${suggestion}`,
    };
  }

  return { ok: true, email };
}
