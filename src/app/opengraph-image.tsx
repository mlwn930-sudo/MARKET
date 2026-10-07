import { ImageResponse } from "next/og";
import { rtl } from "@/lib/og-text";

/**
 * The card a link to this site arrives as.
 *
 * Generated rather than designed. A PNG in `public/` would be one more
 * thing to redraw every time the palette moves, and the palette has moved
 * twice — the site went from paper to a dark ground and the asset would
 * still be showing the old one. This is built from the same colours the
 * CSS uses, so it cannot fall behind them by more than a deploy.
 *
 * It costs nothing: `next/og` renders at build time on the Hobby plan, and
 * the result is a static file served from the CDN. No image service, no
 * key, no per-render charge. Rule 1 holds.
 *
 * The design is the site's own and deliberately quiet. Ground, a hairline,
 * the name, and one sentence about what the thing does. No chart, because
 * a chart on a share card is a number without its context — the exact
 * thing rule 5 exists to prevent, and a card is the one place a reader
 * cannot ask a follow-up question.
 */

export const alt = "Market Intel — מודיעין שוק ההון";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The ground, straight from luminous.css. */
const GROUND = "#060B15";
const INK = "#EAF1FF";
const MUTED = "#AEBFDC";
const BRAND = "#2855F5";
const CYAN = "#00B8E6";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GROUND,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* The light comes from behind, never from a number — the one rule
            that survives into a 1200x630 rectangle. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -160,
            width: 760,
            height: 760,
            borderRadius: 999,
            background: `radial-gradient(circle, ${BRAND}55 0%, ${BRAND}00 68%)`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            left: -200,
            width: 720,
            height: 720,
            borderRadius: 999,
            background: `radial-gradient(circle, ${CYAN}33 0%, ${CYAN}00 68%)`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${BRAND}, ${CYAN})`,
              display: "flex",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 27,
              letterSpacing: 7,
              color: INK,
              fontWeight: 600,
            }}
          >
            MARKET INTEL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Broken into lines here rather than left to wrap.

              `rtl` hands Satori the words already in visual order, so any
              line the renderer breaks for itself takes them in that order
              too — the first visual line gets what should have been the
              last words, and the headline reads bottom-up. Seen on the
              first card: "אותה, ומה בעולם ישפיע עליה" above "כמה החברה
              שווה, מי עוד קונה".

              A line that is reversed as a unit cannot be mis-wrapped, so
              the breaks are decided here where the sentence is known. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 64,
              lineHeight: 1.18,
              color: INK,
              fontWeight: 700,
            }}
          >
            {["כמה החברה שווה, מי עוד קונה אותה,", "ומה בעולם ישפיע עליה"].map(
              (line) => (
                <div key={line} style={{ display: "flex" }}>
                  {rtl(line)}
                </div>
              ),
            )}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, maxWidth: 900 }}>
            {rtl("מחקר לשוק ההון האמריקאי — כל מדד מול חציון הסקטור שלו")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            borderTop: "1px solid rgba(148,178,224,0.22)",
            paddingTop: 26,
            fontSize: 23,
            color: "#7C8DAC",
          }}
        >
          <div style={{ display: "flex" }}>SEC EDGAR · 13F · FRED</div>
          <div style={{ display: "flex", color: "#49597A" }}>—</div>
          <div style={{ display: "flex" }}>{rtl("אינו ייעוץ השקעות")}</div>
        </div>
      </div>
    ),
    size,
  );
}
