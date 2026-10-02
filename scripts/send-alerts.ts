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
import { approvedSubscribers, alertsConfigured } from "../src/lib/alerts/subscribers";
import { mailConfigured, sendMail } from "../src/lib/alerts/mailer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

const WATCH = resolve(ROOT, "content/watch/latest.json");
const LEDGER = resolve(ROOT, "content/watch/sent.json");

type Finding = {
  kind: "move" | "range" | "event" | "story" | "opportunity";
  ticker: string | null;
  headline: string;
  detail: string;
  weight: number;
  href: string | null;
  at: string;
};

/* Only the sharper half of the scan is worth a message. A quarter-range
   edge is interesting on the page and is not worth interrupting someone's
   day; an unusual move and a dated event are. */
const WORTH_SENDING = new Set(["opportunity", "move", "event", "story"]);
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

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://market-intel.vercel.app").replace(
    /\/$/,
    "",
  );

function digest(findings: Finding[], unsubscribeUrl: string) {
  const rows = findings
    .map((f) => {
      const link = f.href?.startsWith("http") ? f.href : `${site()}${f.href ?? ""}`;
      const title = f.headline.replace(/</g, "&lt;");
      const detail = f.detail.replace(/</g, "&lt;");
      return `<tr><td style="padding:14px 0;border-top:1px solid rgba(255,255,255,.14)">
<a href="${link}" style="display:block;font-size:15px;line-height:1.5;color:#EAF1FF;text-decoration:none;font-weight:500">${title}</a>
<div style="margin-top:5px;font-size:13px;line-height:1.6;color:#AEBFDC">${detail}</div>
</td></tr>`;
    })
    .join("");

  const plain = findings
    .map((f) => `• ${f.headline}\n  ${f.detail}`)
    .join("\n\n");

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

  const readers = await approvedSubscribers();
  if (readers.length === 0) {
    console.log(`${fresh.length} new findings, but no approved subscribers`);
    return;
  }

  let delivered = 0;
  for (const reader of readers) {
    const message = digest(
      fresh,
      `${site()}/api/alerts/unsubscribe?email=${encodeURIComponent(reader)}`,
    );
    const result = await sendMail({ to: reader, ...message });
    if (result.ok) delivered++;
    else console.log(`  ${reader}: ${result.reason} ${result.detail ?? ""}`);
  }

  /* The ledger records what was sent only if something actually went out.
     Marking findings as sent after a total failure would bury them. */
  if (delivered > 0) {
    const updated = [...sent, ...fresh.map(fingerprint)].slice(-400);
    await mkdir(dirname(LEDGER), { recursive: true });
    await writeFile(
      LEDGER,
      JSON.stringify({ updatedAt: new Date().toISOString(), sent: updated }, null, 2),
      "utf8",
    );
  }

  console.log(
    `${fresh.length} findings sent to ${delivered}/${readers.length} subscribers`,
  );
}

main();
