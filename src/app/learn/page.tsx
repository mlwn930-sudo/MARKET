import { LEARN_SECTIONS } from "@/lib/learn-content";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";

export const metadata = {
  title: "מרכז ידע",
  description:
    "מה כל מדד באתר באמת מודד, איך לקרוא אותו, ואיפה בדרך כלל טועים.",
};

/**
 * The glossary.
 *
 * The one page on the site set in the serif, at a reading measure rather
 * than a dashboard width. It is prose, and the change of voice says so
 * before a word is read — everywhere else the typography is there to make
 * figures scannable, and here there are no figures.
 *
 * Each entry ends on its trap, with its own rule beside it, because the
 * trap is the part worth remembering. Knowing what the initials stand for
 * is easy; what costs money is not knowing when the number misleads.
 */
export default function LearnPage() {
  const entryCount = LEARN_SECTIONS.reduce(
    (sum, section) => sum + section.entries.length,
    0,
  );

  return (
    <Page width="read">
      <Hero
        eyebrow="מרכז ידע"
        title="מה המספר באמת אומר"
        lede={`${entryCount} מושגים שמופיעים באתר — מה כל אחד מודד, איך לקרוא אותו, ובעיקר איפה בדרך כלל טועים בו.`}
      />

      <nav
        className="mt-10 flex flex-wrap gap-2"
        aria-label="מעבר לנושא"
      >
        {LEARN_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="pill">
            {section.title}
          </a>
        ))}
      </nav>

      {LEARN_SECTIONS.map((section) => (
        <Section
          key={section.id}
          id={section.id}
          eyebrow={section.title}
          description={section.intro}
        >
          <div className="space-y-3">
            {section.entries.map((entry) => (
              <article key={entry.term} className="surface p-5">
                <h3 className="flex flex-wrap items-baseline gap-2.5">
                  <span className="num text-[15px] font-medium text-accent">
                    {entry.term}
                  </span>
                  {entry.hebrew && (
                    <span className="text-[13px] font-normal text-ink-faint">
                      {entry.hebrew}
                    </span>
                  )}
                </h3>

                <p className="editorial mt-3 text-[15px] leading-relaxed text-ink">
                  {entry.what}
                </p>

                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                  <span className="text-ink">איך קוראים את זה: </span>
                  {entry.howToRead}
                </p>

                {/* The trap gets its own rule because it is the part that is
                    actually worth remembering. */}
                <p className="mt-4 border-s-2 border-accent ps-4 text-[13px] leading-relaxed text-ink-muted">
                  <span className="text-accent">המלכודת: </span>
                  {entry.trap}
                </p>
              </article>
            ))}
          </div>
        </Section>
      ))}

      <Disclaimer extra="ההסברים כאן נועדו לעזור לקרוא את הנתונים באתר. אף מדד בודד אינו מספיק להחלטה, וגם צירוף של כולם אינו מחליף הבנה של מה החברה עושה בפועל." />
    </Page>
  );
}
