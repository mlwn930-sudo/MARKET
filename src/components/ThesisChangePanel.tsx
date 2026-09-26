import Link from "next/link";
import type { StoredChange } from "@/lib/intel/history-store";
import { DRIVER_LABELS } from "@/lib/intel/thesis-memory";
import { GradeChip, DerivedMark } from "./SignalCard";

/**
 * What the site used to think, and what it thinks now.
 *
 * The layout is the argument: the old view and the new view side by side
 * at equal weight, then why, then the evidence. Putting the new view on
 * top and the old one in a footnote would let the reader skip the part
 * that makes this honest — the site was saying something else last month,
 * and it is showing you what.
 *
 * `driver` is the field that keeps this from becoming noise. A thesis
 * that moved because a 10-Q landed is a statement about the business; one
 * that moved because the multiple re-rated on the same filing is a
 * statement about the price. They are printed differently and they are
 * never merged, because a tool that announces "thesis change" every time
 * a stock has a good week gets ignored by the fourth time.
 */
export function ThesisChangePanel({
  change,
  /** Adds the company name and a link — for a list covering many. */
  showCompany = false,
}: {
  change: StoredChange;
  showCompany?: boolean;
}) {
  const priceOnly = change.driver === "price";

  return (
    <article className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
        <DerivedMark title="זוהה בהשוואה בין שתי מדידות שמורות" />
        <span className="text-[12px] font-medium text-ink">זוהה שינוי בתזה</span>

        {showCompany && (
          <Link
            href={`/company/${change.ticker}`}
            className="num rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {change.ticker}
          </Link>
        )}

        {/* The distinction the whole panel rests on. Amber when it is the
            price alone, because that is a caveat on the headline above it
            and not a finding about the company. */}
        <span
          className="badge"
          style={
            priceOnly ? { color: "var(--color-warning)" } : undefined
          }
          title={
            priceOnly
              ? "אותו דוח, מכפיל אחר — מה שהשתנה הוא המחיר, לא העסק"
              : "הקלטים המדודים עצמם השתנו"
          }
        >
          {DRIVER_LABELS[change.driver]}
        </span>

        <GradeChip grade={change.claim.grade} />

        <span className="num ms-auto text-[10px] text-ink-ghost">
          {change.from.slice(0, 10)} ← {change.to.slice(0, 10)}
        </span>
      </div>

      {/* Old and new, at the same weight. */}
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-surface p-5">
          <p className="eyebrow mb-2.5">מה האתר אמר קודם</p>
          <p className="text-[13px] leading-relaxed text-ink-faint">
            {change.oldView}
          </p>
        </div>
        <div className="bg-surface p-5">
          <p className="eyebrow mb-2.5">מה הוא אומר עכשיו</p>
          <p className="text-[13px] leading-relaxed text-ink">
            {change.newView}
          </p>
        </div>
      </div>

      <div className="border-t border-line p-5">
        <p className="eyebrow mb-2.5">למה</p>
        <ul className="space-y-2">
          {change.why.map((reason, index) => (
            <li
              key={`${index}-${reason}`}
              className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted"
            >
              <span
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-insight"
                aria-hidden="true"
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Every field that moved, before and after. This is the table that
          makes the claim above checkable rather than quotable. */}
      {change.deltas.length > 0 && (
        <div className="border-t border-line">
          <table className="dt">
            <thead>
              <tr>
                <th scope="col">מה זז</th>
                <th scope="col" className="n">
                  קודם
                </th>
                <th scope="col" className="n">
                  עכשיו
                </th>
              </tr>
            </thead>
            <tbody>
              {change.deltas.map((delta, index) => (
                <tr key={`${index}-${delta.field}`}>
                  <td className="text-ink-muted">{delta.field}</td>
                  <td className="n text-ink-ghost">{delta.before}</td>
                  <td className="n text-ink">{delta.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-line bg-base/40 px-5 py-3.5">
        <p className="num text-[11px] leading-relaxed text-ink-faint">
          {change.claim.basis}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-ghost">
          {change.claim.limits}
        </p>
      </div>
    </article>
  );
}
