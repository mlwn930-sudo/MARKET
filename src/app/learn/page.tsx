import Link from "next/link";
import { LEARN_SECTIONS } from "@/lib/learn-content";
import { AccentTheme } from "@/components/AccentTheme";

export const metadata = {
  title: "מרכז ידע — Market Intel",
  description:
    "מה כל מדד באתר באמת מודד, איך לקרוא אותו, ואיפה בדרך כלל טועים.",
};

export default function LearnPage() {
  const entryCount = LEARN_SECTIONS.reduce(
    (sum, section) => sum + section.entries.length,
    0,
  );

  return (
    <>
      <AccentTheme accent="#c9a227" />
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <h1 className="text-xl">מרכז ידע</h1>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted">
          <span className="num">{entryCount}</span> מושגים שמופיעים באתר —
          מה כל אחד מודד, איך לקרוא אותו, ובעיקר איפה בדרך כלל טועים בו.
          החלק האחרון הוא החשוב: להבין מה ראשי התיבות אומרים זה קל, ומה
          שעולה כסף זה לא לדעת מתי המספר מטעה.
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2">
        {LEARN_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        {LEARN_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-6">
            <h2 className="text-lg">{section.title}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted">
              {section.intro}
            </p>

            <div className="mt-4 space-y-3">
              {section.entries.map((entry) => (
                <article
                  key={entry.term}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <h3 className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="num text-gold">{entry.term}</span>
                    {entry.hebrew && (
                      <span className="text-xs text-ink-muted">
                        {entry.hebrew}
                      </span>
                    )}
                  </h3>

                  <p className="mt-2 text-[13px] leading-relaxed text-ink">
                    {entry.what}
                  </p>

                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                    <span className="text-ink">איך קוראים את זה: </span>
                    {entry.howToRead}
                  </p>

                  {/* The trap gets its own visual weight because it is the
                      part that is actually worth remembering. */}
                  <p className="mt-3 border-r-2 border-line-strong pr-3 text-[13px] leading-relaxed text-ink-muted">
                    <span className="text-gold">המלכודת: </span>
                    {entry.trap}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-ink-faint">
        ההסברים כאן נועדו לעזור לקרוא את הנתונים באתר ואינם ייעוץ השקעות.
        אף מדד בודד אינו מספיק להחלטה, וגם צירוף של כולם אינו מחליף הבנה של
        מה החברה עושה בפועל.
      </p>

      <p className="mt-4 text-xs">
        <Link href="/" className="text-ink-muted hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </p>
    </main>
    </>
  );
}
