import Link from "next/link";
import { Wordmark } from "./Wordmark";

/**
 * The footer.
 *
 * Carries the licence constraint and the sources, because both are facts a
 * reader is entitled to before they weigh a figure: where a number came
 * from, and on what terms this site is allowed to show it.
 */

const COLUMNS = [
  {
    title: "ניתוח",
    links: [
      { href: "/", label: "סקירת שוק" },
      { href: "/opportunities", label: "רדאר הזדמנויות" },
      { href: "/institutional", label: "מעקב מוסדי" },
      { href: "/ai", label: "שרשרת ה-AI" },
    ],
  },
  {
    title: "מידע",
    links: [
      { href: "/news", label: "חדשות מנותחות" },
      { href: "/learn", label: "מרכז ידע" },
      { href: "/launch/ttwo", label: "Take-Two ו-GTA VI" },
    ],
  },
];

/* Everything the site actually reads, including the two it leaned on
   hardest without saying so. Yahoo carries the price history, the macro
   board, the whole-universe quote fetch, extended hours and Tel Aviv;
   GDELT carries the geopolitical events. A credits list that names the
   three easy ones and omits the two doing most of the work is not a
   credits list. */
const SOURCES = [
  { name: "SEC EDGAR", note: "דוחות כספיים ו-13F" },
  { name: "Finnhub", note: "ציטוטים חיים וחדשות" },
  { name: "Yahoo Finance", note: "היסטוריית מחירים, מאקרו ומסחר מחוץ לשעות" },
  { name: "FRED", note: "ריבית חסרת סיכון" },
  { name: "GDELT", note: "אירועים גאופוליטיים" },
];

export function SiteFooter() {
  return (
    <footer className="financial-footer mt-14 border-t border-line bg-[var(--color-surface-plain)]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-ink-faint">
              מודיעין שוק ההון האמריקאי — מה החברה שווה, מי עוד קונה אותה,
              ומה קורה בעולם שישפיע עליה.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="eyebrow">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="eyebrow">מקורות</h2>
            <ul className="mt-4 space-y-2.5">
              {SOURCES.map((source) => (
                <li key={source.name} className="text-[13px]">
                  <span className="text-ink-muted">{source.name}</span>
                  <span className="mr-2 text-[11px] text-ink-ghost">
                    {source.note}
                  </span>
                </li>
              ))}
            </ul>
            {/* A five-line list cannot carry the terms each source comes
                with, and the terms are the part that matters. */}
            <Link
              href="/sources"
              className="mt-4 inline-block text-[12px] text-accent"
            >
              המקורות המלאים והתנאים שלהם ←
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6 text-[11px] leading-relaxed text-ink-ghost">
          <p>
            האתר מציג נתונים וניתוחים לצורכי מחקר בלבד ואינו מהווה ייעוץ
            השקעות, שיווק השקעות או תחליף לייעוץ מקצועי המתחשב בנתוניו של כל
            אדם. נתוני SEC מבוססים על דוחות שהוגשו ועשויים לשקף מצב שאינו
            עדכני.
          </p>
          <p className="mt-2">
            פרויקט אישי, לא מסחרי — רישיון השימוש של ספקי הנתונים מתיר שימוש
            פרטי בלבד.
          </p>
        </div>
      </div>
    </footer>
  );
}
