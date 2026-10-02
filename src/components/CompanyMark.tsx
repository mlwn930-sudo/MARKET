"use client";

import { useState } from "react";
import { identityFor } from "@/lib/company-identity";
import { logoFor } from "@/lib/company-logos";

/**
 * A mark for every company, drawn here.
 *
 * The site shipped eight SVG files — Apple's, Google's, Meta's, NVIDIA's
 * and four more — and 115 of the 123 companies had nothing. So the board
 * was both incomplete and, for the eight it did cover, redistributing
 * other people's registered trademarks from this project's own server.
 * Those two problems have one answer: stop shipping logos and draw a mark
 * instead.
 *
 * What it draws is a monogram on the company's own identifying colour.
 * Using a brand's colour to identify it is ordinary editorial practice —
 * it is how every financial page distinguishes one row from the next — and
 * two letters set in this site's typeface is this site's work, not
 * anybody's logo. Nothing here is a reproduction of a mark, and nothing
 * implies the company endorses the page it sits on.
 *
 * It is deterministic: the same ticker always produces the same mark, so a
 * company looks the same on the board, on its own page and in search.
 *
 * It now carries the company's real logo on top wherever the data provider
 * publishes one, and the monogram stays underneath rather than being
 * replaced. That ordering is the design: a logo that 404s, a symbol with no
 * published image, or a reader on a network that blocks the CDN all land on
 * the drawn mark instead of a torn-page icon or an empty square. The image
 * is referenced from Finnhub's own host and never copied here — see
 * lib/company-logos.ts for why that distinction is the whole point.
 *
 * `.TA` is stripped before the letters are taken. Tel Aviv tickers arrive
 * as "LUMI.TA", and the first two characters of that are still "LU" — but
 * a four-letter Israeli ticker whose suffix leaks into the monogram would
 * read as a different company on the one page that lists them all.
 */

type Size = "sm" | "md" | "lg";

const DIMENSION: Record<Size, number> = { sm: 26, md: 34, lg: 52 };

/** Readable on either, chosen by the colour's own luminance rather than by
 *  a list — the brand table has 60-odd colours in it and a list would rot
 *  the first time one was added. */
function inkFor(hex: string): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.42 ? "#0B1220" : "#FFFFFF";
}

export function CompanyMark({
  ticker,
  size = "md",
  className,
}: {
  ticker: string;
  size?: Size;
  className?: string;
}) {
  const symbol = ticker.replace(/\.TA$/i, "").toUpperCase();
  const accent = identityFor(symbol).accent;
  const letters = symbol.slice(0, 2);
  const px = DIMENSION[size];
  const logo = logoFor(symbol);

  /* Failure is a state, not an exception: the image is dropped from the DOM
     on error so the monogram underneath becomes the mark, rather than
     leaving a broken-image icon over the company's own colour. */
  const [broken, setBroken] = useState(false);

  return (
    <span
      className={`company-mark company-mark--${size}${className ? ` ${className}` : ""}`}
      style={{
        width: px,
        height: px,
        background: accent,
        color: inkFor(accent),
      }}
      aria-hidden="true"
    >
      {letters}
      {logo && !broken && (
        /* eslint-disable-next-line @next/next/no-img-element --
           deliberately NOT next/image. That would fetch the file and
           re-serve it from this project's own domain, which is precisely
           the trademark redistribution this component exists to stop. A
           plain img leaves the request with the browser and the file with
           its owner. */
        <img
          src={logo}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="company-mark-logo"
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}
