import { NextResponse } from "next/server";
import {
  alertsConfigured,
  requestAlerts,
} from "@/lib/alerts/subscribers";
import { verifyAddress } from "@/lib/alerts/verify-address";
import { approvalRequest, mailConfigured, ownerEmail, sendMail } from "@/lib/alerts/mailer";

/**
 * Someone asks for alerts.
 *
 * Nothing is sent to the address itself at this point. It is recorded as
 * pending and the owner is asked, on their phone, whether it should
 * receive anything — which is the whole design: this is a private research
 * site, and the subscriber list is the owner's decision rather than
 * whoever filled in the form.
 *
 * The response never reveals whether an address was already on the list.
 * A sign-up form that answers "already subscribed" differently from "added"
 * is an oracle for checking who reads this site, which is exactly the kind
 * of thing an address given in good faith should not expose.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  /* Falls back to the host that served this request, so the approval link
     works on localhost during development and on the deployment in
     production without either being hard-coded. */
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  /* Checked before anything is stored or sent: the domain has to exist
     and take mail, it must not be a throwaway, and an obvious misspelling
     of a common provider is reported with the correction rather than
     accepted. No key and no round trip through anyone’s inbox — it works
     whether or not the mail service is configured, which is the state this
     site is in. */
  const verdict = await verifyAddress(String(body.email ?? ""));
  if (!verdict.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: verdict.message,
        reason: verdict.reason,
        ...(verdict.suggestion ? { suggestion: verdict.suggestion } : {}),
      },
      { status: 400 },
    );
  }
  const email = verdict.email;

  /* No store means the address cannot be kept, and taking it anyway would
     be collecting something and dropping it. The reader is told, and the
     door lets them through regardless — see the gate. */
  if (!alertsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "ההתראות עדיין לא מחוברות. אפשר להיכנס — פשוט לא יישלח דבר.",
      },
      { status: 503 },
    );
  }

  const stored = await requestAlerts(email);
  if (!stored.ok) {
    return NextResponse.json(
      { ok: false, error: "לא הצלחנו לשמור את הכתובת. נסו שוב." },
      { status: 503 },
    );
  }

  /* Already decided: nothing to ask the owner, and nothing to tell the
     visitor beyond the same neutral answer everyone gets. */
  if (stored.token && mailConfigured()) {
    const origin = siteOrigin(request);
    const message = approvalRequest(
      email,
      `${origin}/api/alerts/decide?token=${encodeURIComponent(stored.token)}&verdict=approve`,
      `${origin}/api/alerts/decide?token=${encodeURIComponent(stored.token)}&verdict=block`,
    );
    const sent = await sendMail({ to: ownerEmail(), ...message });
    if (!sent.ok) {
      /* The address is already recorded, so this is not a failure of the
         sign-up — it is the owner not being told yet. Logged for the
         server, never surfaced as an error to the visitor, whose part is
         complete. */
      console.error("[alerts] approval mail not sent:", sent.reason, sent.detail ?? "");
    }
  }

  return NextResponse.json({
    ok: true,
    /* Deliberately the same answer for a new address, a pending one and an
       approved one. */
    message: "נרשם. ההתראות יישלחו אחרי אישור בעל האתר.",
  });
}
