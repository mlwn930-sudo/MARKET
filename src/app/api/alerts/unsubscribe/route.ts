import { forget, normalizeEmail } from "@/lib/alerts/subscribers";

/**
 * Removal, from the link in every message.
 *
 * It takes the address rather than a token on purpose. A token would be
 * tidier, but an unsubscribe link that has expired is an unsubscribe link
 * that does not work, and somebody trying to stop receiving mail should
 * never meet a failure. The worst case is that one reader removes another
 * reader's address, which costs nothing and cannot be used to discover who
 * is on the list: the answer is the same whether the address was there or
 * not.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("email") ?? "";
  const email = normalizeEmail(raw);
  if (email) await forget(email);

  return new Response(
    `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>הוסר</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#060B15;color:#EAF1FF;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px">
<div style="max-width:420px;text-align:center">
<div style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.34em;color:#7FA5FF;margin-bottom:20px">MARKET INTEL</div>
<h1 style="margin:0 0 12px;font-size:24px;font-weight:600">הוסרת מרשימת ההתראות</h1>
<p style="margin:0;font-size:15px;line-height:1.8;color:#AEBFDC">הכתובת נמחקה מהרשימה, לא סומנה. לא יישלח אליה דבר.</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
