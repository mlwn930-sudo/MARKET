/**
 * Sends what the scan found, once per finding.
 *
 * It runs straight after scripts/watch-market.ts in the same scheduled job,
 * so the mail goes out on the cadence the scan does rather than on one of
 * its own.
 *
 * THE PART THAT MATTERS IS NOT SENDING TWICE. The scan runs every half hour
 * and a company that moved four deviations this morning will still have
 * moved four deviations at the next run, and the one after that. Mailing
 * that each time is how an alert list teaches people to ignore it. So every
 * finding gets a stable fingerprint — its kind, its ticker and the day —
 * and a fingerprint that has already been sent is never sent again. The
 * ledger is kept in the repository beside the scan, which is safe because
 * it holds no addresses: only hashes of findings.
 *
 * WHAT IT WILL NOT DO. It will not mail a quiet day. If nothing clears the
 * bar, nobody hears from the site — a daily message that says "nothing
 * happened" is the fastest way to make the next one invisible.
 *
 * Run with:  npm run alerts
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { approvedWithWatchlists, alertsConfigured } from "../src/lib/alerts/subscribers";
import { mailConfigured, sendMail } from "../src/lib/alerts/mailer";
import {
  RELEVANCE_LABELS,
  RELEVANCE_ORDER,
  type Relevance,
} from "../src/lib/alerts/relevance";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const WATCH = resolve(ROOT, "content/watch/latest.json");
const COMPANIES = resolve(ROOT, "content/watch/companies.json");
const LEDGER = resolve(ROOT, "content/watch/sent.json");

type Finding = {
  kind:
    | "move"
    | "range"
    | "event"
    | "story"
    | "opportunity"
    /* From the per-company agent: a thesis that moved, a date coming, a
       level being tested, the last session read, and a story read through
       the three lenses before it is sent. */
    | "thesis"
    | "catalyst"
    | "level"
    | "tape"
    | "news";
  ticker: string | null;
  headline: string;
  detail: string;
  weight: number;
  /** How much this is worth the reader looking at, and why. Absent on the
   *  market scan findings, which have not been through the tiering yet —
   *  they default to the middle rather than claiming a rank. */
  relevance?: Relevance | null;
  relevanceWhy?: string | null;
  href: string | null;
  at: string;
};

/* Only the sharper half of the scan is worth a message. A quarter-range
   edge is interesting on the page and is not worth interrupting someone's
   day; an unusual move and a dated event are. */
/** The grades the thesis diff uses, in words a reader can weigh. */
const GRADE_WORDS: Record<string, string> = {
  confirmed: "מאושרת",
  likely: "סבירה",
  possible: "אפשרית",
  speculative: "ספקולטיבית",
};

const WORTH_SENDING = new Set([
  /* The per-company agent's findings lead, because they are about a
     company somebody chose rather than one that happened to move. A thesis
     that stopped holding is the most consequential thing this site can
     tell anybody, and it is also the rarest. */
  "thesis",
  "catalyst",
  /* The three a person watching a handful of names checks every day, and
     which this digest could not carry because nothing produced them:
     where the price sits against a level it has turned at before, what
     the last session looked like on volume, and what was written about
     the company.

     All three are per-company by construction — watch-companies.ts
     computes them only for symbols somebody follows — so they reach an
     inbox already narrowed to a watchlist rather than being filtered down
     to it afterwards. */
  "level",
  "tape",
  "news",
  "opportunity",
  "move",
  "event",
  "story",
]);
const MIN_WEIGHT = 2.2;

/** Kind, ticker and calendar day. The same company moving unusually on two
 *  different days is two findings; the same one re-detected six times in
 *  one day is one. */
function fingerprint(f: Finding): string {
  const day = f.at.slice(0, 10);
  return createHash("sha256")
    .update(`${f.kind}|${f.ticker ?? ""}|${day}|${f.headline.slice(0, 80)}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Where the links in an alert email point.
 *
 * This fell back to a hard-coded "market-intel.vercel.app", which is a
 * guess at a domain rather than a fact about one. The failure mode is
 * quiet and total: if the deployment ever lives anywhere else, every link
 * in every alert goes somewhere unrelated, and the only person who would
 * find out is a reader clicking one.
 *
 * It still falls back, because an alert with imperfect links beats no
 * alert when something actually moved — but it now says so on the way
 * past, on every run, in the job log. A guess that announces itself is a
 * guess somebody can fix.
 */
const site = () => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const withScheme = /^https?:\/\//i.test(configured)
      ? configured
      : `https://${configured}`;
    return withScheme.replace(/\/+$/, "");
  }
  console.warn(
    "::warning::NEXT_PUBLIC_SITE_URL is not set, so every link in this " +
      "email points at a guessed domain. Add it under Settings > Secrets " +
      "and variables > Actions.",
  );
  /* The project, not a guess at it. The previous value here was
     "market-intel.vercel.app", which is a plausible name for this site and
     is in fact a DIFFERENT site belonging to somebody else — confirmed by
     fetching it. Every link in every alert pointed there. */
  return "https://michaelmarket1232.vercel.app";
};

function digest(findings: Finding[], unsubscribeUrl: string) {
  /* Sorted by what was measured to matter, not by raw weight. A digest
     whose first line is the largest number rather than the most
     informative one teaches the reader to scroll. */
  const ordered = [...findings].sort(
    (a, b) =>
      RELEVANCE_ORDER[a.relevance ?? "medium"] -
        RELEVANCE_ORDER[b.relevance ?? "medium"] || b.weight - a.weight,
  );

  /* The three tiers, coloured by what they are rather than by direction.
     Gold is this site's reserved tone for "a thing with a date on it, and
     a caveat"; the quiet tier is ghost ink, because an item that says of
     itself that it added no information should not be competing for
     attention with one that did. */
  const TIER_STYLE: Record<string, string> = {
    high: "background:rgba(214,168,74,.16);color:#D6A84A",
    medium: "background:rgba(148,178,224,.12);color:#AEBFDC",
    low: "background:rgba(148,178,224,.07);color:#7C8DAC",
  };

  const rows = ordered
    .map((f) => {
      const link = f.href?.startsWith("http") ? f.href : `${site()}${f.href ?? ""}`;
      const title = f.headline.replace(/</g, "&lt;");
      /* Paragraph breaks survive into the mail. The reading carries the
         impact, the price reaction and the value chain as separate
         thoughts, and running them together is how an analysis becomes a
         wall. */
      const detail = f.detail
        .replace(/</g, "&lt;")
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
      const tier = f.relevance ?? "medium";
      const why = (f.relevanceWhy ?? "").replace(/</g, "&lt;");
      return `<tr><td style="padding:16px 0;border-top:1px solid rgba(255,255,255,.14)">
<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;${TIER_STYLE[tier]}">${RELEVANCE_LABELS[tier as keyof typeof RELEVANCE_LABELS]}</span>
<a href="${link}" style="display:block;margin-top:8px;font-size:15px;line-height:1.5;color:#EAF1FF;text-decoration:none;font-weight:500">${title}</a>
<div style="margin-top:6px;font-size:13px;line-height:1.7;color:#AEBFDC">${detail}</div>
${why ? `<div style="margin-top:8px;font-size:11px;line-height:1.6;color:#7C8DAC">למה בדירוג הזה: ${why}</div>` : ""}
</td></tr>`;
    })
    .join("");

  const plain = ordered
    .map(
      (f) =>
        `[${RELEVANCE_LABELS[(f.relevance ?? "medium") as keyof typeof RELEVANCE_LABELS]}] ${f.headline}\n${f.detail}` +
        (f.relevanceWhy ? `\nלמה בדירוג הזה: ${f.relevanceWhy}` : ""),
    )
    .join("\n\n———\n\n");

  const count = findings.length;
  return {
    subject:
      count === 1
        ? `MARKET — ${findings[0].headline.slice(0, 70)}`
        : `MARKET — ${count} ממצאים חדשים`,
    text: `${plain}\n\nלאתר: ${site()}\nלהסרה: ${unsubscribeUrl}`,
    html: `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#060B15;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#0D1626;border:1px solid rgba(255,255,255,.14);border-radius:12px">
<tr><td style="padding:26px 24px">
<div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.34em;color:#7FA5FF;margin-bottom:6px">MARKET INTEL</div>
<div style="font-size:12px;color:#7C8DAC;margin-bottom:16px">מה שהסורק מצא</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${rows}</table>
<p style="margin:22px 0 0;font-size:11px;line-height:1.7;color:#7C8DAC">כל שורה היא תצפית עם המספר שהפיק אותה, לא המלצה. האתר אינו ייעוץ השקעות.<br><a href="${unsubscribeUrl}" style="color:#7FA5FF">להסרה מהרשימה</a></p>
</td></tr></table></body></html>`,
  };
}

async function main() {
  if (!alertsConfigured()) {
    console.log("no DATABASE_URL — nothing to send to, and nothing recorded");
    return;
  }
  if (!mailConfigured()) {
    console.log("no RESEND_API_KEY — alerts are off");
    return;
  }

  const scan = JSON.parse(await readFile(WATCH, "utf8")) as { findings: Finding[] };

  /* The company agent's output, merged in. Missing is not a failure: it has
     simply not run yet, and the market scan is still worth sending. */
  const perCompany: Finding[] = await readFile(COMPANIES, "utf8")
    .then((raw) => {
      const parsed = JSON.parse(raw) as {
        findings?: {
          kind: string;
          ticker: string;
          headline: string;
          detail: string;
          weight: number;
          grade?: string | null;
          relevance?: Relevance | null;
          relevanceWhy?: string | null;
          at: string;
          href: string;
        }[];
      };
      return (parsed.findings ?? []).map((f) => ({
        kind: f.kind as Finding["kind"],
        ticker: f.ticker,
        headline: f.headline,
        /* The grade travels with the sentence. A change the diff graded
           "possible" must not arrive in an inbox reading like a fact. */
        detail: f.grade && f.grade !== "confirmed"
          ? `${f.detail} · דרגת הטענה: ${GRADE_WORDS[f.grade] ?? f.grade}`
          : f.detail,
        /* Scaled onto the same axis as the market scan, whose weights are
           standard deviations and sit between 2 and 5. Materiality is a
           0-100 score, and merging the two without this would sort every
           thesis change above everything else by arithmetic accident. */
        weight: 2.5 + Math.min(f.weight, 100) / 100,
        /* The tier the agent earned, carried rather than recomputed. It
           was decided next to the measurement that justified it — the base
           rate, the level's record, the model's reading of the story — and
           none of that is available here. */
        relevance: f.relevance ?? null,
        relevanceWhy: f.relevanceWhy ?? null,
        href: f.href,
        at: f.at,
      }));
    })
    .catch(() => []);

  scan.findings = [...perCompany, ...scan.findings];
  const sent: string[] = await readFile(LEDGER, "utf8")
    .then((raw) => JSON.parse(raw).sent ?? [])
    .catch(() => []);
  const already = new Set(sent);

  const fresh = scan.findings
    .filter((f) => WORTH_SENDING.has(f.kind) && f.weight >= MIN_WEIGHT)
    .filter((f) => !already.has(fingerprint(f)))
    /* A digest nobody reads to the end is a digest that failed. */
    .slice(0, 6);

  if (fresh.length === 0) {
    console.log("nothing new worth sending");
    return;
  }

  const readers = await approvedWithWatchlists();
  if (readers.length === 0) {
    console.log(`${fresh.length} new findings, but no approved subscribers`);
    return;
  }

  let delivered = 0;
  const sentFingerprints = new Set<string>();

  for (const reader of readers) {
    /* Each person gets their own companies and nobody else's.
     *
     * A findings list across a hundred and twenty-three companies is a
     * market report, and a market report that arrives four times a day
     * stops being read. The watchlist is the reader's own statement of
     * what they care about, so it is the filter.
     *
     * Following nothing means hearing nothing. That is the honest reading
     * of an empty list — "I have not told you what I follow" is not the
     * same as "send me everything", and guessing the second from the first
     * is how an alert list becomes spam. The line below says so in the
     * log, because silence with no explanation looks like a broken job. */
    if (reader.tickers.length === 0) {
      console.log(`  ${reader.email}: follows nothing yet — nothing to send`);
      continue;
    }

    const watched = new Set(reader.tickers);
    const theirs = fresh.filter((f) => f.ticker !== null && watched.has(f.ticker));
    if (theirs.length === 0) {
      console.log(
        `  ${reader.email}: ${fresh.length} findings, none on their ${reader.tickers.length} companies`,
      );
      continue;
    }

    const message = digest(
      theirs,
      `${site()}/api/alerts/unsubscribe?email=${encodeURIComponent(reader.email)}`,
    );
    const result = await sendMail({ to: reader.email, ...message });
    if (result.ok) {
      delivered++;
      /* Only what actually went to somebody is marked as sent. A finding
         nobody follows must stay unsent, or the day one of them does
         follow that company they would never hear about it. */
      theirs.forEach((f) => sentFingerprints.add(fingerprint(f)));
      console.log(`  ${reader.email}: ${theirs.length} of ${fresh.length}`);
    } else {
      console.log(`  ${reader.email}: ${result.reason} ${result.detail ?? ""}`);
    }
  }

  /* The ledger records what was sent only if something actually went out.
     Marking findings as sent after a total failure would bury them. */
  if (delivered > 0) {
    const updated = [...sent, ...sentFingerprints].slice(-400);
    await mkdir(dirname(LEDGER), { recursive: true });
    await writeFile(
      LEDGER,
      JSON.stringify({ updatedAt: new Date().toISOString(), sent: updated }, null, 2),
      "utf8",
    );
  }

  console.log(
    `${fresh.length} fresh findings · mailed ${delivered}/${readers.length} subscribers · ${sentFingerprints.size} marked sent`,
  );
}

main();
