import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * The shared layout vocabulary.
 *
 * Every page is assembled from these, which is the only reason the site
 * reads as one product rather than as eighteen pages that happen to share
 * a stylesheet. A page that needs something these do not provide should
 * get a new primitive here, not a one-off block of classes.
 *
 * The set is deliberately small and deliberately unequal: there are three
 * ways to group things and one way to show a figure, because grouping is
 * where a layout has real choices to make and a figure is not.
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
      className={`mx-auto px-5 pb-28 sm:px-8 ${
        width === "wide" ? "max-w-[1400px]" : "max-w-[860px]"
      }`}
    >
      {children}
    </main>
  );
}

/**
 * A section, and the silence around it.
 *
 * The spacing comes from `--gap-section` rather than from a utility typed
 * here, so the rhythm of the whole site changes in one place. `tight` is
 * for a section that continues the previous one's thought rather than
 * opening a new one — the gap is what tells the reader which it is.
 *
 * The eyebrow and the rule carry the structure, which is what lets the
 * headings stay a normal size. Making every heading large to mark a
 * boundary is how a page ends up with nothing left to emphasise with.
 */
export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  id,
  tight = false,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`${tight ? "gap-section-tight" : "gap-section"} ${className}`}
    >
      {(eyebrow || title) && (
        <div className="gap-head flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="max-w-2xl">
            {eyebrow && (
              <div className="mb-3 flex items-center gap-2.5">
                <span className="section-mark" aria-hidden="true" />
                <span className="eyebrow">{eyebrow}</span>
              </div>
            )}
            {title && <h2 className="title">{title}</h2>}
            {description && (
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
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
 * The opener: a label, a headline, a line of context, the action, and
 * then the figures.
 *
 * That order is the whole design. A small uppercase label says where you
 * are; the headline is the only large type on the screen; the lede is
 * deliberately small, because a subtitle set nearly as large as its
 * headline destroys both. Everything after is data.
 *
 * Deliberately not full-height. A hero that fills the viewport costs the
 * reader a scroll before they see a single number, which on a research
 * tool is the entire product pushed below the fold.
 *
 * The image is a band behind the text rather than a backdrop for the
 * page, and it appears once per page — the moment a photograph repeats
 * down a page it stops being atmosphere and becomes decoration.
 */
export function Hero({
  eyebrow,
  title,
  lede,
  stats,
  action,
  image,
  imageAlt,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  stats?: ReactNode;
  action?: ReactNode;
  image?: string;
  imageAlt?: string;
  /** A line of status beside the eyebrow: a clock, a feed state. */
  meta?: ReactNode;
}) {
  return (
    <div className="relative">
      {image && (
        /* Full-bleed rather than held to the content column: the band is
           the page's horizon, and a horizon that stops at a margin reads as
           a picture someone placed there.

           The negative start margin is what undoes the rail. This element
           is centred on the column it lives in, and that column is inset
           by the rail — so without pulling it back by half a rail the
           image sits off-centre by 116px on every desktop page, and its
           far edge lands outside the viewport. Body-level `overflow-x:
           clip` catches whatever the scrollbar's own width adds.

           Not negatively z-indexed. A negative z-index paints the band
           behind the opaque body background, which is why an earlier
           version loaded the image and showed nothing at all. */
        <div
          className="pointer-events-none absolute start-1/2 top-0 h-[360px] w-screen -translate-x-1/2 overflow-hidden rtl:translate-x-1/2 sm:h-[460px]"
          style={{ marginInlineStart: "calc(var(--rail-w) / -2)" }}
        >
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.42]"
          />
          {/* Three washes rather than one. The first darkens the image
              enough for text to sit on it at contrast; the second dissolves
              its bottom edge so the band ends rather than stops; the third
              pulls the leading edge down, which is what keeps a busy
              photograph from fighting the headline set over it. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,11,20,0.55)_0%,rgba(6,11,20,0.78)_52%,var(--color-base)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_left,transparent_35%,rgba(6,11,20,0.7)_100%)]" />
        </div>
      )}

      <div className={`relative pt-14 sm:pt-16 ${image ? "sm:pt-32" : ""}`}>
        <div className="enter flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">{eyebrow}</span>
          </span>
          {meta}
        </div>

        <h1 className="display-xl enter mt-5 max-w-4xl text-balance">
          {title}
        </h1>

        {lede && <p className="lede enter mt-5">{lede}</p>}

        {action && <div className="enter mt-7">{action}</div>}
        {stats && <div className="enter mt-9">{stats}</div>}
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
      {sub && <div className="context-line mt-1.5">{sub}</div>}
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

/**
 * The price chip.
 *
 * A filled shape rather than coloured text, because the question it
 * answers — "which of these forty rows are down" — is answered by shape
 * scanning, not by reading. The sign is part of the value, never a
 * separate glyph: bidi moves a detached sign to the far side of an RTL
 * line, and a "+" that lands after the digits is a wrong number.
 */
export function Delta({
  value,
  absolute,
  size = "md",
}: {
  /** Percent change. */
  value: number | null | undefined;
  /** The move in currency, shown beside the percentage when given. */
  absolute?: string;
  size?: "sm" | "md";
}) {
  const known = value !== null && value !== undefined && Number.isFinite(value);
  const dir = !known ? "flat" : value! > 0 ? "up" : value! < 0 ? "down" : "flat";
  const text = known
    ? `${value! > 0 ? "+" : value! < 0 ? "−" : ""}${Math.abs(value!).toFixed(2)}%`
    : "—";

  return (
    <span
      className={`delta ${size === "sm" ? "text-[11px]" : ""}`}
      data-dir={dir}
    >
      {text}
      {absolute && <span className="opacity-60">{absolute}</span>}
    </span>
  );
}

/**
 * The headline quote: NUMBER, then CHANGE, then CONTEXT.
 *
 * Three sizes, three weights, three colours, and that is the entire
 * design. A reader takes the price in one fixation, the direction in the
 * second, and the freshness only if they went looking for it — which is
 * the correct order of importance and therefore the correct order of
 * emphasis.
 */
export function Quote({
  price,
  change,
  absolute,
  context,
  live,
}: {
  price: ReactNode;
  change: number | null | undefined;
  absolute?: string;
  /** When it was last updated, what currency, which exchange. */
  context?: ReactNode;
  live?: ReactNode;
}) {
  return (
    <div>
      <div className="figure-hero text-ink">{price}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Delta value={change} absolute={absolute} />
        {live}
      </div>
      {context && <div className="context-line mt-2.5">{context}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

/**
 * A figure and its meaning, with no box around it.
 *
 * The primitive that exists to be used instead of a card. A headline, a
 * value and the comparison that qualifies it belong together, and the
 * previous habit of giving each its own rounded panel was the main reason
 * a page of six related numbers looked like six unrelated products.
 */
export function Field({
  label,
  value,
  context,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  tone?: "neutral" | "up" | "down";
  className?: string;
}) {
  const toneClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";

  return (
    <div className={className}>
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className={`num mt-1.5 text-[17px] ${toneClass}`}>{value}</div>
      {context && <div className="context-line mt-1.5">{context}</div>}
    </div>
  );
}

/**
 * A band of fields, divided by hairlines and open at the edges.
 *
 * One border around the whole group rather than one per item. It is the
 * difference between a set of readings on an instrument and a shelf of
 * boxes, and it costs nothing but the restraint to stop drawing borders.
 */
export function Band({
  children,
  columns = 4,
  className = "",
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  const grid =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : columns === 6
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          : "grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className={`surface grid ${grid} divide-x divide-y divide-x-reverse divide-line [&>*]:px-5 [&>*]:py-4 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The interpretation that follows a set of figures.
 *
 * Marked with a rule in the page tint rather than boxed, because it is
 * the same thought continued — the moment it gets its own panel the
 * reader stops connecting it to the numbers above it.
 */
export function Reading({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 border-s-2 ps-5" style={{ borderColor: "var(--tint)" }}>
      {title && <h4 className="eyebrow mb-2">{title}</h4>}
      <div className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        {children}
      </div>
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
        {/* Neutral, not the page tint. Forty-eight of these down a screener
            in the accent turns a page of measurements into a page of
            highlights, and on a company page the tint is that company's
            brand colour — which would make a filled segment look like
            approval rather than a count.

            Styled by attribute rather than by an inline style object. The
            screener renders roughly eight hundred of these segments, and
            an inline style is serialised twice on a server-rendered page —
            once into the HTML and once into the payload React hydrates
            from. A class costs nothing in either. */}
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="meter-seg" data-on={i < filled} />
        ))}
      </div>
      {hint && <p className="mt-1 text-[10px] text-ink-ghost">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The AI language                                                     */
/* ------------------------------------------------------------------ */

/**
 * The glyph that marks model-written text.
 *
 * Three ascending strokes in a cyan well: a reading being taken, not a
 * character speaking. Explicitly not a sparkle and not an avatar — those
 * say "assistant", and the claim this mark makes is narrower and more
 * useful: a machine wrote this sentence, here is its confidence, and here
 * are the figures it was given.
 */
export function AiMark({ title = "נכתב על ידי מודל" }: { title?: string }) {
  return (
    <span className="ai-mark" title={title}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2 9V6.5M6 9V3.5M10 9V5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{title}</span>
    </span>
  );
}

/** Confidence as three segments. Never a percentage — that would imply a
 *  calibration nobody has measured. */
export function Confidence({
  level,
  label,
}: {
  level: "high" | "medium" | "low";
  label?: string;
}) {
  const text =
    label ??
    (level === "high" ? "ביטחון גבוה" : level === "medium" ? "ביטחון בינוני" : "ביטחון נמוך");

  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-ink-faint">
      <span className="conf" data-level={level} role="img" aria-label={text}>
        <i />
        <i />
        <i />
      </span>
      {text}
    </span>
  );
}

/**
 * The frame around anything a model produced.
 *
 * The header is fixed by contract: the mark, what this is, and the
 * confidence. The footer is fixed too: where the figures came from and
 * when. A generated passage without those two lines is an opinion from
 * nowhere, and the whole reason this component exists is to make
 * publishing one impossible by accident.
 */
export function AiBlock({
  title,
  confidence,
  sources,
  at,
  action,
  children,
  className = "",
}: {
  title: string;
  confidence?: "high" | "medium" | "low";
  /** The datasets the text was built from. */
  sources?: string[];
  /** When it was produced, already formatted. */
  at?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ai-block ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
        <span className="flex items-center gap-2.5">
          <AiMark />
          <span className="text-[12px] font-medium text-ink">{title}</span>
        </span>
        {confidence && <Confidence level={confidence} />}
        {action && <span className="ms-auto">{action}</span>}
      </div>

      <div className="px-5 py-5">{children}</div>

      {(sources?.length || at) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-base/40 px-5 py-2.5">
          {sources && sources.length > 0 && (
            <span className="caption">
              מקורות: <span className="text-ink-faint">{sources.join(" · ")}</span>
            </span>
          )}
          {at && <span className="caption num ms-auto">{at}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Absence                                                             */
/* ------------------------------------------------------------------ */

/**
 * What is shown where there is nothing to show.
 *
 * Never a blank panel and never "אין נתונים" on its own. An empty state
 * has two jobs: say precisely what is missing and why, and give the
 * reader the nearest thing that does exist. The second is the one almost
 * every interface skips, and it is the one that decides whether the
 * reader stays on the site.
 */
export function Empty({
  title,
  reason,
  links,
  compact = false,
}: {
  title: string;
  /** Why it is missing. A cause, not an apology. */
  reason?: string;
  /** Where to go instead. */
  links?: { href: string; label: string; hint?: string }[];
  compact?: boolean;
}) {
  return (
    <div className={`surface ${compact ? "px-5 py-6" : "px-6 py-9"}`}>
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line-strong text-ink-ghost"
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 16 16">
            <path
              d="M2.5 12.5h11M4 10V6.5M8 10V3.5M12 10V8"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
            />
          </svg>
        </span>

        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink">{title}</p>
          {reason && (
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-ink-faint">
              {reason}
            </p>
          )}

          {links && links.length > 0 && (
            <>
              <p className="eyebrow mt-5">מה כן אפשר לבדוק</p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="pill hover:border-line-bright"
                      title={link.hint}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waiting                                                             */
/* ------------------------------------------------------------------ */

/** One grey bar the shape of the text that is coming. */
export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <span
      className={`sk block ${className}`}
      style={width || height ? { width, height } : undefined}
      aria-hidden="true"
    />
  );
}

/**
 * A table waiting for its rows.
 *
 * Built to the same row height and column count as the real table, so the
 * page does not reflow when the data lands. A skeleton of the wrong shape
 * is worse than a spinner: it promises a layout and then moves it.
 */
export function SkeletonTable({
  rows = 6,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="surface overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען נתונים</span>
      <div className="border-b border-line-strong px-4 py-3">
        <Skeleton className="h-2.5" width="90px" />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0"
        >
          <Skeleton className="h-3 flex-1" />
          {Array.from({ length: columns - 1 }, (_, col) => (
            <Skeleton key={col} className="h-3" width="64px" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A chart waiting for its candles: the frame, the axis and a horizon. */
export function SkeletonChart({ height = 320 }: { height?: number }) {
  return (
    <div className="surface p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען גרף</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6" width="160px" />
        <Skeleton className="h-6" width="88px" />
      </div>
      {/* A shape rather than forty-eight equal bars. A flat grey block
          does not read as a chart, and the reader spends the wait
          wondering what is arriving. The heights come from a fixed sine
          rather than from Math.random, which would differ between the
          server render and the client and trip hydration. */}
      <div
        className="mt-4 flex items-end gap-[3px] overflow-hidden rounded-md"
        style={{ height }}
      >
        {Array.from({ length: 48 }, (_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            height={`${34 + Math.sin(i / 3.1) * 22 + Math.sin(i / 11) * 26}%`}
          />
        ))}
      </div>
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
    <p className="mt-24 border-t border-line pt-6 text-[11px] leading-relaxed text-ink-ghost">
      {extra && <>{extra} </>}
      הנתונים מוצגים לצורכי מחקר בלבד ואינם ייעוץ השקעות, שיווק השקעות או
      תחליף לייעוץ המתחשב בנתוניו של כל אדם. המסגרות האנליטיות מתארות את מה
      שכבר קרה בדוחות ובמחיר, ואינן תחזית. המערכת אינה מחוברת לברוקר ואינה
      מבצעת פעולות קנייה או מכירה.
    </p>
  );
}
