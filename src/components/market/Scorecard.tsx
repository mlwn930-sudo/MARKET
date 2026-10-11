import Link from "next/link";
import { scoreLedger } from "@/lib/signals/ledger";
import type { LedgerEntry } from "@/lib/signals/ledger";

/**
 * Whether the site's own stances held.
 *
 * Every figure on this site arrives with a baseline, a sample and a
 * caveat, and until now not one of them was applied to anything the
 * site itself said. The record existed for ten years of someone else's
 * history and nought days of its own.
 *
 * THREE SHARES, NEVER ONE. "62% were right" means nothing alone. It
 * means something beside "the conditions claimed 71%" — the engine
 * underdelivered on its own record — and beside "an arbitrary day gave
 * 58%" — the record was barely worth having. One number here would be
 * the only unqualified figure on the site.
 *
 * AND THE ROWS ARE SHOWN. A reader who can see only the average has
 * been asked to trust it, which is the posture this project exists to
 * avoid.
 */

const DIR_WORD: Record<string, string> = {
  up: "למעלה",
  down: "למטה",
  split: "חלוק",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export function Scorecard({
  entries,
  recent,
}: {
  entries: LedgerEntry[] | null;
  recent: LedgerEntry[];
}) {
  if (!entries || entries.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-ghost">
        הרישום טרם התחיל. כל עמדה שהאתר ייקח תירשם מעכשיו עם המחיר שממנו
        נמדדה, ותקבל ציון כשהאופק שלה ייגמר — שלושה שבועות לסווינג, רבעון
        לטווח הארוך. התשובה הראשונה שתהיה שווה משהו רחוקה חודשים.
      </p>
    );
  }

  const score = scoreLedger(entries);

  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-ink-muted">
        {score.verdict}
      </p>

      {score.agreedShare !== null && (
        <div className="mt-4 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
          {[
            { label: "זזו לכיוון שנטו אליו", value: score.agreedShare },
            { label: "מה שהרשומה הבטיחה", value: score.claimedShare },
            { label: "יום אקראי באותם חלונות", value: score.baselineShare },
          ].map((cell) => (
            <div key={cell.label} className="bg-surface px-3 py-2.5">
              <span className="block text-[11px] leading-tight text-ink-ghost">
                {cell.label}
              </span>
              <span className="num mt-0.5 block text-[18px] text-ink" dir="ltr">
                {cell.value === null ? "—" : pct(cell.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The arithmetic that makes the three numbers mean something,
          said once in words so nobody has to infer it. */}
      {score.agreedShare !== null &&
        score.claimedShare !== null &&
        score.baselineShare !== null && (
          <p className="mt-2 text-[12px] leading-relaxed text-ink-ghost">
            המספר הראשון מול השני אומר אם המנוע עמד ברשומה של עצמו. השני מול
            השלישי אומר אם הרשומה הייתה שווה משהו מלכתחילה. שניהם צריכים
            להיות גדולים, ואף אחד מהם לבדו אינו מספיק.
          </p>
        )}

      {recent.length > 0 && (
        <div className="mt-5">
          <span className="block text-[12px] font-semibold text-ink-faint">
            העמדות שנסגרו לאחרונה
          </span>
          <div className="mt-2 grid gap-px overflow-hidden rounded border border-line bg-line">
            {recent.map((e) => (
              <div
                key={`${e.symbol}|${e.horizon}|${e.asOf}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 bg-surface px-3 py-2"
              >
                <Link
                  href={`/company/${e.symbol}`}
                  className="num text-[13px] text-ink"
                  dir="ltr"
                >
                  {e.symbol}
                </Link>
                <span className="text-[12px] text-ink-muted">
                  {e.horizon === "swing" ? "סווינג" : "רבעון"} ·{" "}
                  {DIR_WORD[e.direction] ?? e.direction}
                </span>
                <span className="num text-[12px] text-ink" dir="ltr">
                  {e.movePct === undefined ? "—" : signed(e.movePct)}
                </span>
                <span className="text-[11.5px] text-ink-ghost">
                  {e.agreed === null
                    ? "לא ניתן לציון"
                    : e.agreed
                      ? "הלך לכיוון"
                      : "הלך נגד"}
                </span>
                <span className="num text-[11px] text-ink-ghost" dir="ltr">
                  {e.asOf} → {e.resolvedAt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The open count is already in the verdict above; repeating it
          here taught the reader to skip the line that follows it. */}
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-ghost">
        עמדה חלוקה אינה נספרת — היא אומרת שהמדידות סותרות זו את זו, וזו אינה טענה על כיוון. ועמדה שעדיין רצה אינה בתוך השיעור: לוח תוצאות שמשמיט את מה שרץ עכשיו אפשר לשפר בהמתנה.
      </p>
    </div>
  );
}
