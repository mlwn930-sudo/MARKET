import { decide } from "@/lib/alerts/subscribers";
import {
  mailConfigured,
  sendMail,
  welcomeMessage,
} from "@/lib/alerts/mailer";

/**
 * The owner's decision, tapped from their phone.
 *
 * It answers with a page rather than JSON, because the thing opening this
 * link is a mail client on a phone and the person reading it wants to see
 * that it worked.
 *
 * GET performs a write, which is normally wrong — a prefetcher or a
 * scanner can follow a link nobody tapped. It is accepted here for one
 * reason: a mail client cannot POST, and an approval flow the owner cannot
 * complete from their inbox is an approval flow that does not happen. The
 * risk is bounded by the token, which is single-use, random, stored only
 * as a hash, and reaches exactly one inbox. The decision it carries is
 * also reversible from the same place.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, tone: "ok" | "bad" = "ok") {
  const accent = tone === "ok" ? "#2FD48F" : "#FF7078";
  return new Response(
    `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#060B15;color:#EAF1FF;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px">
<div style="max-width:420px;text-align:center">
<div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.34em;color:#7FA5FF;margin-bottom:20px">MARKET INTEL</div>
<h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:${accent}">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.8;color:#AEBFDC">${body}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const verdict = params.get("verdict");

  if (!token || (verdict !== "approve" && verdict !== "block")) {
    return page("הקישור אינו תקין", "חסר אסימון או שההחלטה לא ברורה.", "bad");
  }

  const result = await decide(token, verdict === "approve" ? "approved" : "blocked");

  if (!result.ok) {
    /* One message for an expired token, a used one and a forged one. They
       are the same answer from the outside, and telling them apart would
       let someone probe which tokens once existed. */
    return page(
      "הקישור כבר נוצל או פג",
      "ייתכן שההחלטה כבר התקבלה. אפשר להתעלם מההודעה הזו.",
      "bad",
    );
  }

  if (verdict === "block") {
    return page(
      "הכתובת נחסמה",
      `${result.email ?? "הכתובת"} לא תקבל התראות. היא נשארת חסומה גם אם תירשם שוב.`,
      "bad",
    );
  }

  /* The welcome is the first thing the subscriber hears, and it is also
     the proof that mail actually reaches them — so a failure here is worth
     reporting to the owner on the page they are already looking at. */
  let delivered = true;
  if (result.email && mailConfigured()) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const message = welcomeMessage(
      result.email,
      `${origin}/api/alerts/unsubscribe?email=${encodeURIComponent(result.email)}`,
    );
    const sent = await sendMail({ to: result.email, ...message });
    delivered = sent.ok;
    if (!sent.ok) {
      console.error("[alerts] welcome not sent:", sent.reason, sent.detail ?? "");
    }
  }

  return page(
    "אושר",
    delivered
      ? `${result.email ?? "הכתובת"} תקבל מעכשיו התראות על ממצאי הסורק.`
      : `${result.email ?? "הכתובת"} אושרה, אבל הודעת הפתיחה לא נשלחה. בדרך כלל זה אומר שעדיין אין דומיין מאומת ב-Resend, ולכן אפשר לשלוח רק לכתובת שלך.`,
  );
}
