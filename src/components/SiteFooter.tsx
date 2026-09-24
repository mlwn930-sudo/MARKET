import Link from "next/link";

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

const SOURCES = [
  { name: "SEC EDGAR", note: "דוחות כספיים ו-13F" },
  { name: "Finnhub", note: "ציטוטים חיים וחדשות" },
  { name: "FRED", note: "ריבית חסרת סיכון" },
];

export function SiteFooter() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
                style={{
                  background: "var(--color-accent-dim)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent-line)",
                }}
                aria-hidden="true"
              >
                M
              </span>
              <span className="editorial text-[15px] text-ink">
                Market Intel
              </span>
            </div>
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
