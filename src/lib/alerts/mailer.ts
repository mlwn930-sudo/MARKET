/**
 * Sending mail, and being honest when it cannot.
 *
 * Resend's free tier is 3,000 messages a month and 100 a day, which is
 * far more than a private research site with a handful of readers will
 * ever use. It is the whole dependency: no SMTP server, no queue, one key.
 *
 * TWO THINGS THE OWNER HAS TO KNOW, because they are limits of the service
 * and not of this code:
 *
 *  - Without a verified domain, Resend only delivers to the address that
 *    owns the account. That is enough for the approval mail, which goes to
 *    the owner, and not enough for alerts to anybody else. Verifying a
 *    domain lifts it; until then the subscribe flow still records and
 *    still asks for approval, and alerts to other people simply do not
 *    arrive. The code reports that rather than pretending it sent.
 *  - Nothing here retries. A send that fails is reported to the caller and
 *    the caller decides; a scheduled job that silently swallowed a failure
 *    would leave the owner believing readers were being told things they
 *    were never told.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Resend's shared sender, which works with no domain at all — but only
 *  to the account owner's own address. A verified domain replaces it
 *  through ALERT_FROM. */
const DEFAULT_FROM = "MARKET <onboarding@resend.dev>";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "no-key" | "rejected" | "failed"; detail?: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Where approval requests go. The owner's own address, overridable so a
 *  personal address is configuration rather than a line of source. */
export function ownerEmail(): string {
  return process.env.ALERT_OWNER_EMAIL?.trim() || "mlwn930@gmail.com";
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "no-key" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM?.trim() || DEFAULT_FROM,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      /* Resend's own message is kept: "you can only send to your own
         address until a domain is verified" is the single most likely
         failure here, and paraphrasing it would hide the fix. */
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "rejected", detail: detail.slice(0, 300) };
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id ?? null };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/* ------------------------------------------------------------------ */
/* The two messages this site sends                                    */
/* ------------------------------------------------------------------ */

/**
 * Mail is not the web: no external stylesheet, no custom font, and layout
 * that survives a client that ignores most CSS. Inline styles on a table
 * is the form that works everywhere, which is why these look older than
 * the site does.
 */
function shell(bodyHtml: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#060B15;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#0D1626;border:1px solid rgba(255,255,255,.14);border-radius:12px">
<tr><td style="padding:26px 24px">
<div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.34em;color:#7FA5FF;margin-bottom:18px">MARKET INTEL</div>
${bodyHtml}
</td></tr></table></body></html>`;
}

export function approvalRequest(email: string, approveUrl: string, blockUrl: string) {
  const safe = email.replace(/</g, "&lt;");
  return {
    subject: `בקשה חדשה להתראות — ${email}`,
    text:
      `הכתובת ${email} נרשמה לקבלת התראות באתר.\n\n` +
      `לאשר: ${approveUrl}\nלחסום: ${blockUrl}\n\n` +
      `עד שתאשר, הכתובת לא מקבלת דבר.`,
    html: shell(
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#EAF1FF">נרשמה כתובת חדשה לקבלת התראות:</p>
<p style="margin:0 0 22px;font:600 16px/1.4 ui-monospace,monospace;color:#EAF1FF;direction:ltr;text-align:left">${safe}</p>
<p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:#AEBFDC">עד שתאשר, הכתובת הזו לא מקבלת שום הודעה.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-left:10px"><a href="${approveUrl}" style="display:inline-block;background:#2855F5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600">לאשר</a></td>
<td><a href="${blockUrl}" style="display:inline-block;color:#AEBFDC;text-decoration:none;padding:12px 18px;font-size:14px;border:1px solid rgba(255,255,255,.24);border-radius:999px">לחסום</a></td>
</tr></table>`,
    ),
  };
}

export function welcomeMessage(email: string, unsubscribeUrl: string) {
  return {
    subject: "ההתראות שלך ב-MARKET פעילות",
    text:
      `הכתובת ${email} אושרה ומעכשיו תקבל התראות על תנועות חריגות, ` +
      `קצה טווח, מועדים מתקרבים וכתבות מהותיות.\n\n` +
      `להסרה בכל רגע: ${unsubscribeUrl}`,
    html: shell(
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#EAF1FF">הכתובת שלך אושרה.</p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.8;color:#AEBFDC">מעכשיו תקבל הודעה כשהסורק מוצא תנועה חריגה ביחס לחברה עצמה, קצה טווח רבעוני, מועד מאושר שמתקרב, או כתבה שהניתוח סימן כמהותית. לא נשלח דבר ביום שבו אין ממצא.</p>
<p style="margin:0;font-size:12px;color:#7C8DAC">להסרה בכל רגע: <a href="${unsubscribeUrl}" style="color:#7FA5FF">לחצו כאן</a>. האתר אינו ייעוץ השקעות.</p>`,
    ),
  };
}

/**
 * "You are now following X" — sent the moment a company is added.
 *
 * It carries the latest story about that company and the reading of it,
 * because a confirmation that only confirms is a message nobody needs. If
 * the feed has nothing on the company yet it says so plainly rather than
 * padding: an empty section under a heading is the thing this project
 * spends most of its time removing.
 */
export function followedMessage(options: {
  ticker: string;
  name: string;
  story: {
    title: string;
    url: string;
    domain: string;
    summary: string | null;
    impact: string | null;
  } | null;
  companyUrl: string;
  unsubscribeUrl: string;
}) {
  const { ticker, name, story, companyUrl, unsubscribeUrl } = options;
  const safe = (s: string) => s.replace(/</g, "&lt;");

  const storyHtml = story
    ? `<div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14)">
<div style="font:600 10px/1 ui-monospace,monospace;letter-spacing:.1em;color:#7C8DAC;margin-bottom:8px">הכתבה האחרונה</div>
<a href="${story.url}" style="font-size:15px;line-height:1.5;color:#EAF1FF;text-decoration:none;font-weight:500">${safe(story.title)}</a>
<div style="margin-top:4px;font-size:11px;color:#7C8DAC" dir="ltr">${safe(story.domain)}</div>
${
  story.summary
    ? `<div style="margin-top:14px;padding-inline-start:10px;border-inline-start:2px solid rgba(0,184,230,.42)">
<div style="font:600 10px/1 ui-monospace,monospace;letter-spacing:.1em;color:#7C8DAC;margin-bottom:6px">קריאת מודל</div>
<div style="font-size:13px;line-height:1.7;color:#AEBFDC">${safe(story.summary)}</div>
${story.impact ? `<div style="margin-top:8px;font-size:12.5px;line-height:1.7;color:#9FB2CF"><span style="color:#AEBFDC">השפעה: </span>${safe(story.impact)}</div>` : ""}
</div>`
    : `<div style="margin-top:12px;font-size:12px;line-height:1.7;color:#7C8DAC">הכתבה עדיין לא נקראה על ידי המודל. הניתוח נכתב בהרצה המתוזמנת ויופיע באתר כשיגיע.</div>`
}
</div>`
    : `<div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);font-size:13px;line-height:1.7;color:#AEBFDC">אין כרגע כתבה על החברה הזו בפיד. ברגע שתהיה — תקבל אותה כאן.</div>`;

  const storyText = story
    ? `\n\nהכתבה האחרונה: ${story.title}\n${story.url}` +
      (story.summary ? `\n\nקריאת מודל: ${story.summary}` : "") +
      (story.impact ? `\nהשפעה: ${story.impact}` : "")
    : "\n\nאין כרגע כתבה על החברה הזו בפיד.";

  return {
    subject: `עוקב אחרי ${ticker} — ${name}`,
    text:
      `הוספת את ${name} (${ticker}) למעקב. מעכשיו ההתראות יכללו אותה.` +
      storyText +
      `\n\nלעמוד החברה: ${companyUrl}\nלהסרה: ${unsubscribeUrl}`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#EAF1FF">נוספה למעקב: <strong dir="ltr">${safe(name)}</strong></p>
<p style="margin:0;font:600 13px/1.4 ui-monospace,monospace;color:#7FA5FF" dir="ltr">${safe(ticker)}</p>
<p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#AEBFDC">מעכשיו ההתראות שתקבל יהיו על החברות שבמעקב שלך בלבד.</p>
${storyHtml}
<p style="margin:22px 0 0"><a href="${companyUrl}" style="display:inline-block;background:#2855F5;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-size:14px;font-weight:600">לעמוד החברה והניתוח המלא</a></p>
<p style="margin:20px 0 0;font-size:11px;line-height:1.7;color:#7C8DAC">האתר אינו ייעוץ השקעות.<br><a href="${unsubscribeUrl}" style="color:#7FA5FF">להסרה מהרשימה</a></p>`,
    ),
  };
}
