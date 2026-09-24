import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * The shared layout vocabulary.
 *
 * Every page is assembled from these, which is the only reason the site
 * reads as one product rather than as eight pages that happen to share a
 * stylesheet. A page that needs something these do not provide should get
 * a new primitive here, not a one-off block of classes.
 */

/* ------------------------------------------------------------------ */
/* Page frame                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sets the page's ambient tint and holds its content at a readable width.
 *
 * The tint colours the light behind the page and the small marks that open
 * each section. It is deliberately NOT the accent: it never touches text,
 * a control or a figure, so a company page can feel like that company
 * without any figure on it changing colour.
 */
export function Page({
  tint,
  children,
  width = "wide",
}: {
  tint?: string;
  children: ReactNode;
  /** `wide` for dashboards and tables, `read` for prose-led pages. */
  width?: "wide" | "read";
}) {
  const style = tint
    ? ({ "--tint": tint, "--tint-dim": `${tint}1a` } as CSSProperties)
    : undefined;

  return (
    <main
      style={style}
      className={`mx-auto px-5 pb-24 sm:px-8 ${
        width === "wide" ? "max-w-[1400px]" : "max-w-[900px]"
      }`}
    >
      {children}
    </main>
  );
}

/**
 * A section, with the breathing room the old design did not have.
 *
 * The eyebrow and the rule carry the structure so headings can stay a
 * normal size — the previous version made every heading large to mark a
 * boundary, which left nothing to emphasise with.
 */
export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  id,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`mt-16 sm:mt-20 ${className}`}>
      {(eyebrow || title) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            {eyebrow && (
              <div className="mb-3 flex items-center gap-2.5">
                <span className="section-mark" aria-hidden="true" />
                <span className="eyebrow">{eyebrow}</span>
              </div>
            )}
            {title && <h2 className="title">{title}</h2>}
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

/**
 * The opener: a title, a line of context, and the figures that matter
 * before anything is scrolled.
 *
 * Deliberately not full-height. A hero that fills the screen costs the
 * reader a scroll before they see a single number, which on a research
 * tool is the whole product pushed below the fold.
 *
 * The image, when there is one, is a band behind the text rather than a
 * backdrop for the page. It is `priority` because it is the largest paint
 * on the screen and lazy-loading it is what makes a page feel slow.
 */
export function Hero({
  eyebrow,
  title,
  lede,
  stats,
  action,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  stats?: ReactNode;
  action?: ReactNode;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <div className="relative">
      {image && (
        /* Full-bleed rather than held to the content column: the band is
           the page's horizon, and a horizon that stops at a margin reads as
           a picture someone placed there.

           Not negatively z-indexed. A negative z-index here paints the band
           behind the opaque body background, which is why an earlier
           version loaded the image and showed nothing at all. */
        <div className="pointer-events-none absolute start-1/2 top-0 h-[340px] w-screen -translate-x-1/2 overflow-hidden rtl:translate-x-1/2 sm:h-[440px]">
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.55]"
          />
          {/* Two washes: one to darken the image enough for text to sit on
              it at contrast, one to dissolve its bottom edge so the band
              ends rather than stops. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,10,15,0.3)_0%,rgba(8,10,15,0.72)_55%,var(--color-base)_100%)]" />
        </div>
      )}

      <div
        className={`relative pt-12 sm:pt-16 ${image ? "sm:pt-28" : ""}`}
      >
        <div className="enter flex items-center gap-2.5">
          <span className="section-mark" aria-hidden="true" />
          <span className="eyebrow">{eyebrow}</span>
        </div>

        <h1 className="display enter mt-4 max-w-3xl">{title}</h1>

        {lede && (
          <p className="enter mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            {lede}
          </p>
        )}

        {action && <div className="enter mt-6">{action}</div>}
        {stats && <div className="enter mt-8">{stats}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

/**
 * A labelled figure.
 *
 * The label sits above the value and stays small and muted, because the
 * number is the content and the label is the caption. Reversing that — a
 * bold label over a small number — is the single most common way a
 * financial interface ends up looking like a form.
 */
export function Stat({
  label,
  value,
  sub,
  size = "md",
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Only a price change may be up or down. */
  tone?: "neutral" | "up" | "down";
}) {
  const valueClass =
    size === "lg" ? "figure-lg" : size === "sm" ? "num text-base" : "num text-xl";

  const toneClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";

  return (
    <div>
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className={`mt-1 ${valueClass} ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

/** A horizontal strip of figures, divided rather than boxed. */
export function StatBar({ children }: { children: ReactNode }) {
  return (
    <div className="surface grid grid-cols-2 divide-x divide-x-reverse divide-line sm:grid-cols-4">
      {children}
    </div>
  );
}

export function StatCell({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="px-5 py-4">
      <Stat label={label} value={value} sub={sub} tone={tone} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Measures                                                            */
/* ------------------------------------------------------------------ */

/**
 * A measure against its scale — the shape the opportunity radar is built
 * from.
 *
 * Drawn as segments rather than as a continuous bar. A bar invites the
 * reader to compare lengths precisely, which is a precision these scores
 * do not have; ten segments say "roughly seven out of ten" and stop there,
 * which is the honest resolution.
 */
export function Meter({
  label,
  value,
  max = 10,
  hint,
}: {
  label: string;
  value: number | null;
  max?: number;
  hint?: string;
}) {
  const filled =
    value === null ? 0 : Math.max(0, Math.min(Math.round(value), max));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-ink-muted">{label}</span>
        <span className="num text-[11px] text-ink-faint">
          {value === null ? "—" : `${filled}/${max}`}
        </span>
      </div>
      <div
        className="mt-1.5 flex gap-[3px]"
        role="img"
        aria-label={`${label}: ${value === null ? "לא ניתן לחשב" : `${filled} מתוך ${max}`}`}
      >
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-[1px]"
            style={{
              background:
                i < filled ? "var(--tint)" : "rgba(255,255,255,0.07)",
              opacity: i < filled ? 0.45 + (i / max) * 0.55 : 1,
            }}
          />
        ))}
      </div>
      {hint && <p className="mt-1 text-[10px] text-ink-ghost">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** A link that looks like a next step rather than like body text. */
export function MoreLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
    >
      {children}
      <span
        className="transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      >
        ←
      </span>
    </Link>
  );
}

/** The state of something that updates by itself. */
export function LiveBadge({
  state,
  label,
}: {
  state: "live" | "waiting" | "idle";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px]">
      <span
        className={`inline-block h-[5px] w-[5px] rounded-full ${
          state === "live"
            ? "live-dot bg-up"
            : state === "waiting"
              ? "bg-accent"
              : "bg-ink-ghost"
        }`}
        aria-hidden="true"
      />
      <span className={state === "live" ? "text-up" : "text-ink-muted"}>
        {label}
      </span>
    </span>
  );
}

/** The line every analysis page carries. Required by the project rules. */
export function Disclaimer({ extra }: { extra?: string }) {
  return (
    <p className="mt-20 border-t border-line pt-6 text-[11px] leading-relaxed text-ink-ghost">
      {extra && <>{extra} </>}
      הנתונים מוצגים לצורכי מחקר בלבד ואינם ייעוץ השקעות, שיווק השקעות או
      תחליף לייעוץ המתחשב בנתוניו של כל אדם. המסגרות האנליטיות מתארות את מה
      שכבר קרה בדוחות ובמחיר, ואינן תחזית. המערכת אינה מחוברת לברוקר ואינה
      מבצעת פעולות קנייה או מכירה.
    </p>
  );
}
