import { DollarMotif } from "./DollarMotif";
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
      id="main-content"
      tabIndex={-1}
      style={style}
      className={`mx-auto px-5 pb-28 sm:px-8 ${
        width === "wide" ? "max-w-[1440px]" : "max-w-[880px]"
      }`}
    >
      {children}
    </main>
  );
}

/**
 * The head of a section, on its own.
 *
 * Extracted from `Section` because half the site needs the heading
 * without the wrapper — inside a panel, above a table, at the top of a
 * column — and the alternative was every page inventing its own eyebrow and
 * title markup, which is how two headings on one screen end up two
 * different sizes.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  size = "md",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    /* The rule under a section header is the structure the page was
       missing. Every section used to open with the same chip and then
       float free, so a long page read as a stack of unrelated cards —
       which is most of what makes a dashboard look like every other
       dashboard. A hairline that starts at the heading and fades as it
       runs gives the page a spine and a direction, and costs no colour. */
    <div className="section-head flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="max-w-2xl">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">{eyebrow}</span>
          </div>
        )}
        {title &&
          (size === "sm" ? (
            <h3 className="subtitle">{title}</h3>
          ) : (
            <h2 className="title">{title}</h2>
          ))}
        {description && (
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
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
        <div className="gap-head">
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            action={action}
          />
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
 * The opener.
 *
 * A dark cinematic band under a light masthead, full width, with the
 * page's own light inside it. Everything after it is white.
 *
 * That contrast is the identity of the product: the band is the cover of
 * an issue, the content below is the issue. It also solves a problem the
 * all-dark design could not — when every panel is dark, nothing can open
 * a page, so each page opened with a slightly larger heading and hoped.
 *
 * The order inside is fixed and is the whole design. A small uppercase
 * label says where you are; the headline is the only display type on the
 * screen; the lede is deliberately small, because a subtitle set nearly
 * as large as its headline destroys both. Everything after is data.
 *
 * Deliberately not full-height. A hero that fills the viewport costs the
 * reader a scroll before they see a single number, which on a research
 * tool is the entire product pushed below the fold.
 *
 * `tone="light"` exists for the pages that are a continuation rather
 * than an arrival — a company page reached from a table does not need a
 * curtain raised in front of it.
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
  tone = "light",
  aside,
  asideSize = "narrow",
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
  tone?: "dark" | "light";
  /** A figure, a chart or a quote set beside the headline on a wide
   *  screen, and below it on a narrow one. */
  aside?: ReactNode;
  /** `wide` gives the aside nearly half the band — for a hero object
   *  rather than a readout. */
  asideSize?: "narrow" | "wide";
}) {
  const body = (
    <>
      <div
        className={
          !aside
            ? ""
            : asideSize === "wide"
              ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:items-center"
              : "grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end"
        }
      >
        <div>
          <div className="enter flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2.5">
              <span className="section-mark" aria-hidden="true" />
              <span className="eyebrow">{eyebrow}</span>
            </span>
            {meta}
          </div>

          <h1 className="display-xl enter mt-5 max-w-4xl text-balance">{title}</h1>

          {lede && <p className="lede enter mt-5">{lede}</p>}

          {action && <div className="enter mt-7">{action}</div>}
        </div>

        {aside && <div className="enter">{aside}</div>}
      </div>

      {stats && <div className="enter mt-10">{stats}</div>}
    </>
  );

  /**
   * A page that supplies a photograph gets the band that can show one.
   *
   * `image` was accepted, documented, and passed by four pages — and
   * rendered by none of them. The `<Image>` lived only in the dark branch,
   * `tone` defaulted to "light", and no page on the site ever asked for
   * dark. So nine photographs sat in public/hero/ at about two megabytes,
   * committed, shipped and invisible, while every page opened on a flat
   * text block. That disconnect is most of why the site reads as generic:
   * the art direction was written and then never reached the screen.
   *
   * Supplying a photograph is now the request. A page that passes one gets
   * the band; a page that does not keeps the quiet heading, which is right
   * for the pages that are mostly figures.
   */
  const band = tone === "dark" || Boolean(image);

  if (!band) {
    return <header className="product-heading">{body}</header>;
  }

  return (
    /* Full-bleed rather than held to the content column. The band is the
       page's horizon, and a horizon that stops at a margin reads as a
       picture someone placed there.

       The negative start margin undoes whatever inset the column has.
       It reads --rail-w, which is zero now that the rail is gone, so the
       arithmetic is a no-op — and stays, because it is the one place
       that knows how to re-centre a full-bleed band if a column ever
       gains an inset again. */
    <div
      className="hero-dark on-dark relative start-1/2 w-screen -translate-x-1/2 rtl:translate-x-1/2"
      style={{ marginInlineStart: "calc(var(--rail-w) / -2)" }}
    >
      {image && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.28]"
          />
          {/* Two washes rather than one. The first sinks the image far
              enough for text to sit on it at contrast; the second pulls
              the leading edge down, which is what keeps a busy photograph
              from fighting the headline set over it. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.86)_60%,rgba(15,23,42,0.96)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_left,transparent_30%,rgba(15,23,42,0.75)_100%)]" />
        </div>
      )}

      {/* The house mark, set into the trailing edge of the band. Hidden on
          a phone, where the band is barely wider than the headline and the
          mark would sit under the words rather than beside them. It is
          behind the copy and in front of nothing: no figure is ever set
          over it. */}
      <div
        className="pointer-events-none absolute bottom-0 end-[3%] hidden select-none lg:block"
        aria-hidden="true"
      >
        <DollarMotif size={300} opacity={0.13} />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 pb-14 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
        {body}
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
      <div className="text-[12px] text-ink-faint">{label}</div>
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
      className={`delta ${size === "sm" ? "text-[12px]" : ""}`}
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
      <div className="text-[12px] text-ink-faint">{label}</div>
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
      <div className="max-w-3xl text-[14px] leading-relaxed text-ink-muted">
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
        <span className="num text-[12px] text-ink-faint">
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
      {hint && <p className="mt-1 text-[12px] text-ink-ghost">{hint}</p>}
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

/**
 * Model-written text in a slot too narrow for `AiBlock`.
 *
 * `AiBlock` is a card: a header rule, a body and a sources footer. In a
 * column four items tall it costs more height than the text it frames, and
 * the news page's side column answered that by dropping the marking and
 * printing a bare clamped line — which is the one thing that is not
 * allowed, since every passage a model wrote has to be marked as such.
 *
 * So this is the same claim at one tenth the weight: the mark, a label, and
 * the cyan edge that means "a model wrote this" everywhere else on the site.
 * Use it inside a row or a column; use `AiBlock` when the passage is the
 * point of the section rather than a note within it.
 */
export function AiNote({
  label = "קריאת מודל",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ai-note ${className}`}>
      <span className="ai-note-head">
        <AiMark />
        <span>{label}</span>
      </span>
      <div className="ai-note-body">{children}</div>
    </div>
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
    <span className="inline-flex items-center gap-2 text-[12px] text-ink-faint">
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-element/70 px-5 py-2.5">
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
/* When a source does not answer                                       */
/* ------------------------------------------------------------------ */

/**
 * A provider that failed, said in the reader's terms.
 *
 * Separate from Empty on purpose, because the two are different
 * sentences. Empty says the question has no answer yet — nothing filed,
 * nothing built, nothing to show. This says the answer exists and we
 * could not reach it, which is what tells a reader whether coming back
 * later is worth anything.
 *
 * It takes no error object, and that is the whole design. There is no
 * parameter through which a stack trace, an exception message or a raw
 * provider payload could arrive, so none of them can reach the screen by
 * accident. The caller is forced to write a sentence instead of forwarding
 * one, which is the only reliable way to keep internals off the page.
 *
 * The gold edge is the token for a caveat — the same one the screener's
 * warning paragraph carries. Red stays reserved for a price going down.
 */
export function ErrorState({
  title,
  detail,
  source,
  links,
  compact = false,
}: {
  /** What is unavailable, named the way a reader would name it. */
  title: string;
  /** Why, and whether it is worth returning. A cause, not an apology. */
  detail?: string;
  /** Which provider went quiet, where naming it tells the reader something. */
  source?: string;
  /** Where to go instead. */
  links?: { href: string; label: string; hint?: string }[];
  compact?: boolean;
}) {
  return (
    <div
      className={`surface border-s-2 ${compact ? "px-5 py-6" : "px-6 py-9"}`}
      style={{ borderInlineStartColor: "var(--color-warning)" }}
      role="status"
    >
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line-strong"
          style={{ color: "var(--color-warning)" }}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 16 16">
            <path
              d="M8 4.5v4M8 11.2v.05"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              opacity="0.5"
            />
          </svg>
        </span>

        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink">{title}</p>
          {detail && (
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-ink-faint">
              {detail}
            </p>
          )}
          {source && (
            <p className="caption mt-2 text-ink-ghost">
              המקור שלא ענה: <span className="num">{source}</span>
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
      className="group inline-flex items-center gap-1.5 text-[14px] text-ink-muted transition-colors hover:text-ink"
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
    <span className="inline-flex items-center gap-2 text-[12px]">
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
    <p className="mt-24 border-t border-line pt-6 text-[12px] leading-relaxed text-ink-ghost">
      {extra && <>{extra} </>}
      הנתונים מוצגים לצורכי מחקר בלבד ואינם ייעוץ השקעות, שיווק השקעות או
      תחליף לייעוץ המתחשב בנתוניו של כל אדם. המסגרות האנליטיות מתארות את מה
      שכבר קרה בדוחות ובמחיר, ואינן תחזית. המערכת אינה מחוברת לברוקר ואינה
      מבצעת פעולות קנייה או מכירה.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The card set                                                        */
/* ------------------------------------------------------------------ */

/**
 * A figure that is the subject of its own card.
 *
 * `Field` and `Stat` above are figures *inside* something — a band, a
 * row, a panel. This is the one that stands alone, and it is the only
 * one allowed a border, because a card is a claim that this number is
 * worth a frame of its own.
 *
 * The order is fixed: label, value, change, context. The context line is
 * not optional decoration — it is rule 5 of this project, the comparison
 * that turns a figure into knowledge, and a MetricCard without one is a
 * number sitting on a white rectangle.
 */
export function MetricCard({
  label,
  value,
  change,
  context,
  tone = "neutral",
  href,
  footer,
}: {
  label: string;
  value: ReactNode;
  /** Percent change, rendered as the standard chip. */
  change?: number | null;
  context?: ReactNode;
  tone?: "neutral" | "up" | "down";
  href?: string;
  /** A sparkline, a meter, a source line. */
  footer?: ReactNode;
}) {
  const toneClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11.5px] font-medium text-ink-faint">{label}</span>
        {change !== undefined && <Delta value={change} size="sm" />}
      </div>
      <div className={`figure-lg mt-3 ${toneClass}`}>{value}</div>
      {context && <div className="context-line mt-2">{context}</div>}
      {footer && <div className="mt-4">{footer}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="surface lift block px-5 py-4">
        {inner}
      </Link>
    );
  }

  return <div className="surface px-5 py-4">{inner}</div>;
}

/**
 * The frame every table on this site sits in.
 *
 * A caption above, the table inside a clipped surface, a source line
 * below. Writing that markup per page is how one table ends up with a
 * border and the next with a shadow.
 */
export function DataTable({
  title,
  description,
  action,
  children,
  note,
  scroll = true,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** A `<table className="dt">`. */
  children: ReactNode;
  /** The source, the as-of, the caveat. */
  note?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <div>
      {(title || action) && (
        <div className="mb-3">
          <SectionHeader
            title={title}
            description={description}
            action={action}
            size="sm"
          />
        </div>
      )}
      <div className="surface overflow-hidden">
        <div className={scroll ? "overflow-x-auto" : undefined}>{children}</div>
      </div>
      {note && <p className="caption mt-2.5">{note}</p>}
    </div>
  );
}

/**
 * A reading the system produced, framed as one.
 *
 * Carries the indigo mark rather than the cyan one: indigo means the
 * code derived this, cyan means a model wrote it. Two claims, two
 * colours, and a reader who cannot tell them apart cannot tell which
 * sentence they are allowed to check.
 */
export function InsightCard({
  title,
  children,
  tone = "derived",
  meta,
  action,
}: {
  title: string;
  children: ReactNode;
  /** `derived` — computed here. `model` — written by a model. */
  tone?: "derived" | "model";
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={tone === "model" ? "ai-block" : "surface"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3">
        {tone === "model" ? (
          <AiMark />
        ) : (
          <span className="derived-mark" title="נגזר בקוד">
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M2.5 6.5l2.5 2.5 4.5-5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </span>
        )}
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {meta}
        {action && <span className="ms-auto">{action}</span>}
      </div>
      <div className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-muted">
        {children}
      </div>
    </div>
  );
}

/**
 * Where a figure came from.
 *
 * Six origins, and one of them is not like the others: "מודל" is a
 * classification a language model wrote, and it is tinted cyan so it can
 * never be mistaken for a measurement at a glance.
 */
export function SourceBadge({
  source,
  asOf,
}: {
  source: string;
  asOf?: string | null;
}) {
  const model = source === "מודל";
  return (
    <span
      className="badge num"
      style={
        model
          ? {
              color: "#0091b8",
              borderColor: "rgba(0, 184, 230, 0.35)",
              background: "rgba(0, 184, 230, 0.07)",
            }
          : undefined
      }
      title={asOf ? `לפי נתון מ-${asOf}` : undefined}
    >
      {source}
      {asOf && <span className="opacity-60">{` · ${asOf}`}</span>}
    </span>
  );
}

/**
 * One line of evidence: what it is, what it says, where it came from.
 *
 * The source is not a footnote here — it sits on the same line as the
 * value, because the entire contract of this product is that a figure
 * arrives with its origin attached.
 */
export function EvidenceRow({
  label,
  value,
  source,
  asOf,
}: {
  label: string;
  value: ReactNode;
  /** SEC, Finnhub, Yahoo, FRED, חישוב, מודל. */
  source?: string;
  asOf?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-2 last:border-0">
      <span className="text-[11.5px] text-ink-faint">{label}</span>
      <span className="num text-[12.5px] text-ink">{value}</span>
      {source && (
        <span className="ms-auto">
          <SourceBadge source={source} asOf={asOf} />
        </span>
      )}
    </div>
  );
}

/** Confidence, as a badge rather than as a line of text. */
export function ConfidenceBadge({
  level,
}: {
  level: "high" | "medium" | "low";
}) {
  return (
    <span className="badge gap-1.5">
      <span className="conf" data-level={level} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {level === "high" ? "גבוה" : level === "medium" ? "בינוני" : "נמוך"}
    </span>
  );
}

/**
 * A state, as a dot and a word.
 *
 * Never a filled block. A filled green pill in a column that also
 * contains prices reads as a price, which is the one thing colour on
 * this site is reserved for.
 */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "live" | "closed" | "event" | "brand";
  children: ReactNode;
}) {
  return (
    <span className="status" data-tone={tone === "neutral" ? undefined : tone}>
      {children}
    </span>
  );
}

/** Whether a market is trading, said in one chip. */
export function MarketStatus({ open, label }: { open: boolean; label: string }) {
  return (
    <StatusPill tone={open ? "live" : "closed"}>
      <span className={open ? "live-dot" : undefined}>{label}</span>
    </StatusPill>
  );
}

/**
 * The frame around a chart.
 *
 * A chart without a title is a picture; a chart without a source is a
 * claim. This supplies both, plus the row where a control strip belongs,
 * so no page has to invent its own chart chrome.
 */
export function ChartContainer({
  title,
  meta,
  controls,
  children,
  note,
  padded = true,
}: {
  title?: string;
  meta?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="surface overflow-hidden">
      {(title || controls) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
          {title && (
            <span className="text-[14px] font-semibold text-ink">{title}</span>
          )}
          {meta}
          {controls && <span className="ms-auto">{controls}</span>}
        </div>
      )}
      <div className={padded ? "p-4 sm:p-5" : undefined}>{children}</div>
      {note && (
        <div className="border-t border-line px-5 py-2.5">
          <span className="caption">{note}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A company, as a card.
 *
 * Ticker first and large, name second and small — the reverse of how a
 * consumer app would set it, and correct here: a reader scanning for
 * NVDA is scanning for four capital letters, not for "NVIDIA Corporation".
 */
export function CompanyCard({
  ticker,
  name,
  price,
  change,
  context,
  accent,
}: {
  ticker: string;
  name?: string;
  price?: ReactNode;
  change?: number | null;
  context?: ReactNode;
  /** The company's own colour, used for the leading rule only. */
  accent?: string;
}) {
  return (
    <Link
      href={`/company/${ticker}`}
      className="surface lift relative block overflow-hidden px-5 py-4"
    >
      {accent && (
        <span
          className="absolute inset-y-0 start-0 w-[3px]"
          style={{ background: accent }}
          aria-hidden="true"
        />
      )}
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-[15px] font-medium text-ink">{ticker}</span>
        {change !== undefined && <Delta value={change} size="sm" />}
      </div>
      {name && (
        <div className="mt-0.5 truncate text-[12px] text-ink-faint">{name}</div>
      )}
      {price && <div className="num mt-3 text-[19px] text-ink">{price}</div>}
      {context && <div className="context-line mt-1.5">{context}</div>}
    </Link>
  );
}

/**
 * Something with a date on it.
 *
 * Gold, because gold is what this site already uses for a scheduled
 * event and for a caveat, and an earnings date is both. The date is set
 * in the mono face so a column of them lines up.
 */
export function EventCard({
  when,
  title,
  body,
  status,
  source,
}: {
  when: string;
  title: string;
  body?: ReactNode;
  status?: string;
  source?: ReactNode;
}) {
  return (
    <div className="surface flex gap-4 px-5 py-4">
      <span
        className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full"
        style={{ background: "var(--color-event)" }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="num text-[12px] font-medium text-ink">{when}</span>
          {status && <span className="badge">{status}</span>}
        </div>
        <p className="mt-1.5 text-[13.5px] font-medium text-ink">{title}</p>
        {body && (
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            {body}
          </div>
        )}
        {source && <div className="caption mt-2">{source}</div>}
      </div>
    </div>
  );
}

/** The brief's name for `Empty`. Same component, one vocabulary. */
export { Empty as EmptyState };
