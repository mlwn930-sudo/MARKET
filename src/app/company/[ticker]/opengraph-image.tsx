import { ImageResponse } from "next/og";
import { rtl } from "@/lib/og-text";
import { identityFor } from "@/lib/company-identity";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { sectorOf, SECTOR_LABELS } from "@/lib/universe";

/**
 * A company's own share card.
 *
 * The site card says what this place is; this one says which company a
 * link is about, which is the question anyone looking at a pasted URL in a
 * group chat actually has. It carries the ticker, the name, the sector and
 * the company's identifying colour — the same colour its monogram uses on
 * the board, so a reader who has seen the site recognises the card before
 * reading it.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY IS A PRICE OR A METRIC.
 *
 * Three reasons, and the first is enough. A card is cached by whoever
 * scraped it — often for days, sometimes permanently — so a price baked
 * into one is a number that goes stale in minutes and keeps being shown as
 * current. That is rule 9 at its sharpest: a figure that cannot be kept
 * true should not be rendered.
 *
 * The second is rule 5. A P/E on a card has no room for the sector median
 * beside it, and 42.1 alone is the thing this project exists not to
 * publish. The third is rule 8: a single figure on a card reads as a
 * verdict about the company whatever words surround it.
 *
 * So the card identifies and invites. The numbers are on the page, where
 * their context fits.
 */

export const alt = "ניתוח חברה — Market Intel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#060B15";
const INK = "#EAF1FF";
const MUTED = "#AEBFDC";
const GHOST = "#7C8DAC";

/** Dark letters or light ones, decided by the brand colour's own
 *  luminance. The same arithmetic as `CompanyMark`, for the same reason:
 *  white on a mid-bright brand colour is unreadable, and a share card is
 *  seen at thumbnail size where that is worse rather than better. */
function inkOn(hex: string): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a: number, c: number) =>
    (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
  return ratio(L, 0.0055) >= ratio(L, 1) ? "#0B1220" : "#FFFFFF";
}

export default async function Image({
  params,
}: {
  params: { ticker: string };
}) {
  const symbol = decodeURIComponent(params.ticker).toUpperCase();
  const accent = identityFor(symbol).accent;
  /* The name from the measured file rather than from the profile API the
     page uses. A card is generated on demand and then cached by whoever
     scraped it, so spending a rate-limited external call on one is paying
     a recurring price for a string that already sits on disk. A ticker
     outside the universe simply shows as its ticker. */
  const file = await getFundamentalsFile().catch(() => null);
  const name = file?.companies.find((c) => c.ticker === symbol)?.name ?? symbol;
  const sector = sectorOf(symbol);

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
          padding: "68px 80px",
          position: "relative",
        }}
      >
        {/* The company's colour as the light behind the card, not as the
            colour of any word on it. */}
        <div
          style={{
            position: "absolute",
            top: -280,
            right: -180,
            width: 820,
            height: 820,
            borderRadius: 999,
            background: `radial-gradient(circle, ${accent}4D 0%, ${accent}00 68%)`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: GHOST }}>
            MARKET INTEL
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 30,
              background: accent,
              color: inkOn(accent),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 62,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {symbol.replace(/\.TA$/i, "").slice(0, 2)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 40, color: GHOST, letterSpacing: 5 }}>
              {symbol}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 62,
                fontWeight: 700,
                color: INK,
                maxWidth: 760,
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            {sector && (
              <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
                {rtl(SECTOR_LABELS[sector])}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            borderTop: "1px solid rgba(148,178,224,0.22)",
            paddingTop: 24,
            fontSize: 23,
            color: GHOST,
          }}
        >
          <div style={{ display: "flex" }}>
            {rtl("פונדמנטלי מול חציון הסקטור · קריאה טכנית · מחזור · 13F")}
          </div>
          <div style={{ display: "flex", color: "#49597A" }}>—</div>
          <div style={{ display: "flex" }}>{rtl("אינו ייעוץ השקעות")}</div>
        </div>
      </div>
    ),
    size,
  );
}
