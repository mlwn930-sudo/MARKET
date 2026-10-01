import { NextResponse } from "next/server";
import { readChartImage } from "@/lib/analysis/chart-reader";

/**
 * Reads an uploaded chart image.
 *
 * The upload never touches disk and is never stored. It goes from the
 * request body to the model and the response is the read — there is no
 * reason for this project to keep someone's screenshot, and the cheapest
 * way to be sure it does not leak is not to have it anywhere.
 *
 * The size cap is enforced here rather than only in the browser, because a
 * limit that lives in the page is a suggestion.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** Six megabytes of base64, which is about 4.5MB of image — comfortably
 *  more than a full-screen chart screenshot and far short of anything that
 *  would stall the request. */
const MAX_BASE64 = 6 * 1024 * 1024;

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  let body: { mimeType?: string; data?: string; context?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const mimeType = String(body.mimeType ?? "");
  const data = String(body.data ?? "");

  if (!ALLOWED.has(mimeType)) {
    return NextResponse.json(
      { error: "אפשר להעלות PNG, JPEG או WebP." },
      { status: 415 },
    );
  }
  if (!data || data.length > MAX_BASE64) {
    return NextResponse.json(
      { error: "הקובץ גדול מדי. עד כ־4.5MB." },
      { status: 413 },
    );
  }

  const result = await readChartImage(
    { mimeType, data },
    typeof body.context === "string" ? body.context.slice(0, 400) : undefined,
  );

  if (!result.ok) {
    const message =
      result.reason === "no-key"
        ? "מנתח הגרפים לא מוגדר בשרת."
        : result.reason === "empty"
          ? "המודל לא החזיר קריאה. נסו צילום ברור יותר."
          : "הקריאה נכשלה. נסו שוב בעוד רגע.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ read: result.read });
}
