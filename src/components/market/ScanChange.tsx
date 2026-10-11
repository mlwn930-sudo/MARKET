import Link from "next/link";
import type { ScanFile } from "@/lib/signals/scan-store";

/**
 * What moved since the previous session.
 *
 * The scan itself answers a question nobody asks twice: on the second
 * morning it is largely the same twenty-one names, and a list that does
 * not change is a list that stops being read. The difference is the
 * reason to open it daily — who is here that was not, who dropped off,
 * and who turned around.
 *
 * THE TURN IS FIRST, because it is the only one of the three that is
 * about a name already being watched. A holder cares far more that
 * something flipped from up to down than that an unfamiliar ticker
 * appeared.
 *
 * AND LEAVING IS NOT THE SAME AS BEING WRONG. A condition fires on one
 * bar; the next day it has not un-happened, it has simply stopped being
 * the last bar. The copy says so, because "dropped off the list" reads
 * as a verdict otherwise.
 */

const DIR_WORD: Record<string, string> = {
  up: "למעלה",
  down: "למטה",
  split: "חלוק",
};

/** `swing:up,position:down` into something a person reads. */
function phrase(code: string): string {
  return code
    .split(",")
    .map((part) => {
      const [horizon, direction] = part.split(":");
      const span = horizon === "swing" ? "סווינג" : "רבעון";
      return `${span} ${DIR_WORD[direction] ?? direction}`;
    })
    .join(" · ");
}

function Tickers({ list }: { list: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {list.map((symbol) => (
        <Link
          key={symbol}
          href={`/company/${symbol}`}
          className="num inline-flex min-h-6 items-center rounded border border-line px-1.5 text-[11px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          dir="ltr"
        >
          {symbol}
        </Link>
      ))}
    </span>
  );
}

export function ScanChange({ scan }: { scan: ScanFile }) {
  if (!scan.previousAsOf) {
    return (
      <p className="text-[12.5px] leading-relaxed text-ink-ghost">
        אין עדיין סריקה קודמת להשוות אליה. ההשוואה תופיע אחרי הריצה הבאה.
      </p>
    );
  }

  const entered = scan.entered ?? [];
  const left = scan.left ?? [];
  const flipped = scan.flipped ?? [];

  if (entered.length === 0 && left.length === 0 && flipped.length === 0) {
    return (
      <p className="text-[12.5px] leading-relaxed text-ink-ghost">
        אותה רשימה בדיוק כמו ב-
        <span className="num" dir="ltr">
          {scan.previousAsOf}
        </span>
        . זו תשובה — רוב הימים לא משנים דבר.
      </p>
    );
  }

  return (
    <div className="grid gap-2.5 text-[12.5px] leading-relaxed">
      <p className="text-ink-ghost">
        מול הסריקה של{" "}
        <span className="num" dir="ltr">
          {scan.previousAsOf}
        </span>
        :
      </p>

      {flipped.length > 0 && (
        <div>
          <span className="text-ink">התהפכו · </span>
          <span className="text-ink-muted">
            {flipped.map((f, i) => (
              <span key={f.symbol}>
                {i > 0 && " · "}
                <Link
                  href={`/company/${f.symbol}`}
                  className="num text-ink-muted hover:text-ink"
                  dir="ltr"
                >
                  {f.symbol}
                </Link>{" "}
                {phrase(f.from)} ← {phrase(f.to)}
              </span>
            ))}
          </span>
        </div>
      )}

      {entered.length > 0 && (
        <div>
          <span className="text-ink">נכנסו · </span>
          <Tickers list={entered} />
        </div>
      )}

      {left.length > 0 && (
        <div>
          <span className="text-ink">יצאו · </span>
          <Tickers list={left} />
          <span className="mt-1 block text-[11.5px] text-ink-ghost">
            יציאה אינה הפרכה. תנאי פועל בנר אחד, ולמחרת הוא לא התבטל — הוא
            פשוט כבר לא הנר האחרון.
          </span>
        </div>
      )}
    </div>
  );
}
