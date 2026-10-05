import Link from "next/link";
import { learnEntry, sectionOf } from "@/lib/learn-content";

/**
 * The explanation, where the number is.
 *
 * The knowledge centre has been right about the content and wrong about
 * the place since it was built. It holds the thing worth knowing — not
 * what P/E stands for, which anyone can look up, but that a low P/E on a
 * cyclical at the top of its cycle is a warning and not a bargain — and
 * it holds it on a page a reader has to decide to visit. Almost nobody
 * interrupts themselves to go and learn a term. They skim the figure they
 * did not understand, and the part of the page that mattered is the part
 * they lose.
 *
 * So the entry opens under the label it belongs to, and `/learn` becomes
 * the index of something that lives across the site rather than the only
 * place it exists.
 *
 * WHY `<details>` AND NOT A TOOLTIP. A tooltip is a hover, and a hover
 * does not exist on a phone, cannot be reached from a keyboard, and
 * vanishes while being read. `<details>` is open or closed, works with no
 * JavaScript at all, is already focusable, and announces its own state to
 * a screen reader. The site's own rule is that reduced motion gets the
 * information rather than losing it; the same logic applies to a reader
 * who cannot hover.
 *
 * It renders nothing when the term has no entry. An affordance that opens
 * onto an empty box teaches a reader not to press the next one.
 */
export function TermHint({
  term,
  className = "",
}: {
  /** Either name — "P/E" or "מכפיל רווח" both resolve. */
  term: string;
  className?: string;
}) {
  const entry = learnEntry(term);
  if (!entry) return null;

  const section = sectionOf(term);

  return (
    <details className={`term-hint ${className}`}>
      <summary
        /* The label is the term, so the control needs its own name —
           otherwise every one of these on a page announces as "?". */
        aria-label={`מה זה ${entry.term}`}
        title={`מה זה ${entry.term}`}
      >
        <span aria-hidden="true">?</span>
      </summary>

      <div className="term-hint-body">
        <b>
          {entry.term}
          {entry.hebrew && <span className="term-hint-he"> · {entry.hebrew}</span>}
        </b>

        <p>{entry.what}</p>
        <p>{entry.howToRead}</p>

        {/* The trap carries the caveat colour rather than a warning red.
            It is not an error and not a danger — it is the sentence that
            costs people money, which on this site is what gold is for. */}
        <p className="term-hint-trap">
          <span className="micro-label">המלכודת</span>
          {entry.trap}
        </p>

        {section && (
          <Link href={`/learn#${section.id}`} className="term-hint-more">
            עוד ב{section.title} ←
          </Link>
        )}
      </div>
    </details>
  );
}
