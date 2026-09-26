import Link from "next/link";
import type { TransmissionChain } from "@/lib/intel/transmission";
import { GradeChip, DerivedMark } from "./SignalCard";
import { directionClass, fmtPercent } from "@/lib/format";

/**
 * A macro variable, followed all the way to a company.
 *
 * Drawn as steps down a rule rather than as boxes with arrows between
 * them, and the reason is not aesthetic: a diagram of four boxes tells
 * the reader that the four are the same kind of thing. They are not. The
 * first step is a print, the second is a textbook mechanism, the third is
 * a measurement that either agreed with the mechanism or did not, and the
 * fourth is a membership list. Each carries its own grade, and the chain
 * carries the weakest of them.
 *
 * The step that matters most is the third. When the sector moved the way
 * the mechanism predicts, the chain is worth reading; when it moved the
 * other way, the panel says so in the same size type — a mechanism that
 * is only shown on the days it works is a mechanism that never loses.
 */
export function TransmissionPanel({ chain }: { chain: TransmissionChain }) {
  return (
    <article className="surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <DerivedMark title="שרשרת שנבנתה בקוד ממפת רגישויות מוצהרת" />
        <span className="text-[13px] font-medium text-ink">
          {chain.moveText}
        </span>
        <span className="text-ink-ghost" aria-hidden="true">
          ←
        </span>
        <Link
          href={chain.sector.href}
          className="text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          {chain.sector.label}
        </Link>
        <span className="ms-auto">
          <GradeChip grade={chain.claim.grade} />
        </span>
      </div>

      <ol>
        {chain.steps.map((step, index) => (
          <li
            key={`${index}-${step.label}`}
            className="chain-step"
            data-terminal={index === chain.steps.length - 1}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] text-ink">{step.label}</span>
              {step.figure ? (
                <span className="num text-[12px] text-ink-muted">
                  {step.figure}
                </span>
              ) : (
                /* A step with no figure is a mechanism, and the interface
                   says which — otherwise a reader scanning down the chain
                   reads all four steps as measurements. */
                <span className="badge">מנגנון, לא מדידה</span>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-faint">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      {chain.companies.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="eyebrow mb-2.5">
            {chain.expected === "benefit"
              ? "החברות שהמנגנון מיטיב איתן, לפי תנועת היום"
              : "החברות שהמנגנון מכביד עליהן, לפי תנועת היום"}
          </p>
          <div className="flex flex-wrap gap-2">
            {chain.companies.map((company) => (
              <Link
                key={company.ticker}
                href={`/company/${company.ticker}`}
                className="pill hover:border-line-bright"
              >
                <span className="num">{company.ticker}</span>
                {company.changePercent !== null && (
                  <span
                    className={`num ${directionClass(company.changePercent)}`}
                  >
                    {fmtPercent(company.changePercent)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-ghost">
        {chain.claim.limits}
      </p>
    </article>
  );
}
