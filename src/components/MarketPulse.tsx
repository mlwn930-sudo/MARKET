import Link from "next/link";
import type { Instrument } from "@/lib/sources/macro";
import { directionClass, fmtPercent } from "@/lib/format";

/**
 * The pulse strip.
 *
 * Twelve instruments across three families — equities, the price of money,
 * and the things priced in dollars — in one band at the top of the page.
 * The point is not the numbers, which are available anywhere; it is that
 * they sit together. A day when the S&P fell 1%, the ten-year rose and the
 * dollar strengthened is one story, and reading those three figures on
 * three different screens is how a reader misses it.
 *
 * Laid out as a dense band rather than as twelve cards. A card per figure
 * would take the whole first screen and say the same thing — and this site
 * has a rule about card fatigue that it keeps breaking.
 *
 * Nothing here is fabricated: an instrument that did not answer shows a
 * dash, not a zero, because zero is a real value that means "unchanged".
 */

function tick(instrument: Instrument): string {
  if (instrument.value === null) return "—";
  switch (instrument.unit) {
    case "%":
      return `${instrument.value.toFixed(2)}%`;
    case "$":
      return `$${instrument.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    case "₪":
      return `₪${instrument.value.toFixed(3)}`;
    default:
      return instrument.value.toLocaleString("en-US", {
        maximumFractionDigits: 0,
      });
  }
}

export function MarketPulse({
  instruments,
}: {
  instruments: Instrument[];
}) {
  /* The order is the argument: what equities did, what money costs, what
     that did to hard assets and to the shekel. */
  const wanted = [
    "^GSPC",
    "^IXIC",
    "^DJI",
    "^RUT",
    "TA35.TA",
    "^N225",
    "^GDAXI",
    "^VIX",
    "^TNX",
    "GC=F",
    "CL=F",
    "ILS=X",
  ];

  const strip = wanted
    .map((symbol) => instruments.find((i) => i.symbol === symbol))
    .filter((i): i is Instrument => Boolean(i));

  if (strip.length === 0) return null;

  return (
    <section aria-label="דופק השוק">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="section-mark" aria-hidden="true" />
          <span className="eyebrow">דופק השוק</span>
        </div>
        <Link
          href="/macro"
          className="text-[12px] text-ink-muted transition-colors hover:text-ink"
        >
          כל המאקרו ←
        </Link>
      </div>

      <div className="surface grid grid-cols-2 divide-x divide-y divide-x-reverse divide-line sm:grid-cols-3 lg:grid-cols-6">
        {strip.map((instrument) => (
          <div key={instrument.symbol} className="px-4 py-3" title={instrument.note}>
            <div className="truncate text-[11px] text-ink-faint">
              {instrument.name}
            </div>
            <div className="num mt-1 text-[16px] text-ink">
              {tick(instrument)}
            </div>
            <div
              className={`num text-[11px] ${directionClass(instrument.changePercent)}`}
            >
              {/* A yield's story is in basis points; everything else is a
                  percentage of itself. */}
              {instrument.kind === "rate" && instrument.change !== null
                ? `${instrument.change > 0 ? "+" : "−"}${Math.abs(instrument.change * 100).toFixed(0)} נ.ב.`
                : fmtPercent(instrument.changePercent)}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-ink-ghost">
        מדדים אמיתיים ולא תעודות סל · מחירי שוק בהשהיה · מכשיר שלא החזיר
        נתון מוצג כמקף ולא כאפס
      </p>
    </section>
  );
}
