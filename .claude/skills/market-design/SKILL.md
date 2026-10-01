---
name: market-design
description: The Market Intel design system — the night material and its tokens, the mark/ink colour rule with measured contrast ratios, the component vocabulary, motion limits, and the rules about figures, direction colour and third-party imagery. Use this skill for ANY visual work on this site: a new page or section, restyling an existing one, adding a component, changing colour or spacing, touching src/app/*.css, adding an image or icon, or whenever someone says the site looks generic, empty, too AI, or asks to make something prettier. Also use it before adding a dependency that renders UI, and before any scroll or entrance animation — this file records several failures that look like fresh ideas the second time.
---

# Market Intel — design

The principle: **light around the data, discipline inside it.** The ground
glows, the figures stay cold and readable. Every rule below follows from
that, and most of them were learned by breaking something first.

---

## 1. The ground is dark, except one page

The site's surface is `src/app/luminous.css`, scoped to
`body:not(:has(.gta-cover))`. The GTA VI launch story keeps its own art
direction and is the only exclusion. **That selector is the one thing in
the file that must not be relaxed** — widening it silently restyles a page
that was deliberately left alone.

| | value |
|---|---|
| ground | `#060B15` |
| surface | `#0D1626` |
| raised (one step, no second) | `#121D31` |
| text | `#EAF1FF` · `#AEBFDC` · `#9FB2CF` · `#7C8DAC` |
| lines | white at 14% · 24% · 40% |

The ground is not flat: three lights off the corners and one thin ribbon
across the upper page. A dark field that light travels across, not a dark
field with coloured things on it. That distinction is the whole look.

The paper version still exists intact in `financial.css` — one import away
if the dark direction is ever wrong.

---

## 2. Two weights per colour, and the split is measured

Every meaning has a **mark** (the palette at full strength — fills, chart
series, rules, dots, indicators) and an **ink** (the same hue dropped
toward black until it clears 4.5:1 on white, for when the colour has to be
*read* rather than *seen*).

Measured against white — these are facts, not preferences:

| meaning | mark | on white | ink |
|---|---|---|---|
| cobalt (brand) | `#2855F5` | **5.66:1** | needs none |
| violet | `#6757E8` | **5.12:1** | needs none |
| negative | `#E4575D` | 3.61:1 | `#C94D52` |
| magenta | `#F43FBF` | 3.33:1 | `#CE35A1` |
| positive | `#12A66A` | 3.14:1 | `#0F8756` |
| cyan (data) | `#00B8E6` | **2.33:1** | `#0081A1` |
| gold (catalyst) | `#D6A84A` | **2.20:1** | `#907132` |

Cyan and gold at full strength are legible as a line on a chart and
illegible as the caption under it. That is why the split exists.

On the dark ground the problem inverts, so `.on-dark` and the luminous
layer point the `-text` tokens back at the marks. **A component keeps one
token name and comes out right on either ground** — that is the point of
the naming, and it only works if new components read the tokens rather
than hard-coding hexes.

Cobalt is 3.2:1 on the night ground — enough for a border, not for a word.
What a reader reads there is the lighter tint `#7FA5FF`.

---

## 3. Three things that will bite you again

These are not style opinions. Each one cost a debugging session.

**Redefining a token does not redefine its alias.** `globals.css` names
every colour twice — a canonical token and a short alias onto it. A custom
property declared on `:root` that contains `var()` **resolves against
`:root`**, and a descendant inherits the computed result, not the
reference. So setting `--color-text-secondary` on `body` left
`--color-ink-muted` still handing out the old value. **Redeclare the whole
alias layer wherever you redefine the canonical tokens.**

**Tailwind prunes `@theme`.** A variable declared in `@theme` and read only
by hand-written CSS is dropped from the build and resolves to nothing.
Tokens that no utility class references belong in a plain `:root` block.

**Do not guess what a colour change broke — measure it.** After switching
the ground, scanning 493 runs of text against the background actually
behind each one returned *two opposite* failures: dark ink on the new
ground at 1.05:1, and light text over panels that had stayed white at
1.03:1. Both invisible, and only one of them was the one being looked for.
A contrast sweep after any ground or token change is cheap and finds what
reading the diff cannot.

---

## 4. Figures

A figure is set in plain white and **never carries light**. The ground
glows, a panel catches an edge of it, the digit stays crisp — a glowing
digit is a blurred digit, and people read numbers here.

A highlight *behind* a figure is different from a glow *on* one, and is
allowed: the price flash paints a tinted pill behind the number for 0.9s
when it ticks. Draw it with `background` plus a `box-shadow` spread, never
with padding — padding on a figure that flashes reflows the row on every
tick.

`.num` goes on every figure. It is what aligns columns, and in an RTL page
it is also what stops bidi moving a leading sign.

**Rule 5 of the project applies to every figure you add:** a number alone
is a datum, a number against its sector median or its own history is
knowledge. If you cannot show the context, ask whether the figure belongs.

---

## 5. Green and red mean price direction. Nothing else.

Never decoration, never a page accent, never a status that isn't a price
move. A green panel tells the reader something before they have read
anything.

On the night ground the paper values are too dark against the type around
them; direction lifts to `#2FD48F` and `#FF7078`.

---

## 6. Nobody else's work ships here

The site hosts no third-party images, illustrations or logos. This is a
hard line, and it was crossed twice before it was drawn:

- Another studio's key art was served as a page cover, with the permission
  note filed in a developer document no visitor could reach. **Attribution
  is not permission.**
- Eight corporate logo SVGs were bundled and served while 115 of 123
  companies had none — incomplete *and* redistributing registered
  trademarks.

**A company's mark is drawn here**: a monogram on the company's
identifying colour (`CompanyMark`). Using a brand's colour to identify it
is ordinary editorial practice; two letters in this site's typeface are
this site's work. Ink is chosen from the colour's own luminance, not from
a list — the brand table has sixty-odd entries and a list would rot.

News shows headline, source, time and a link. **The publisher's photograph
stays with the publisher.**

When a brief asks for a specific borrowed image, build the idea instead:
the welcome page took a copyrighted character's palette, posture and
setting and became an original bird. Say plainly why, offer the built
version, and do not ship the borrowed one while waiting for an answer.

---

## 7. Motion

Entrance animations are **time-based only** — 400ms, 8px (`.enter`,
`.stagger`), and section arrival through `ScrollReveal`.

**`animation-timeline: view()` is forbidden on content.** This has been
tried and removed twice. A section taller than the viewport never completes
its own entry range, sticks on its opening frame, and the figures inside it
never appear.

**A transform on an ancestor re-parents fixed positioning.** The entrance
cascade was being applied to ScrollTrigger's own pin-spacer, whose 8px
translate silently broke the pin: the section stopped locking, the chapters
stopped advancing, and the page read as two thousand pixels of nothing.
Anything that sets `transform` site-wide must exclude `.pin-spacer` and
anything opting out.

**Reduced motion gets the information without the movement, not the
reverse.** An entrance resolves immediately rather than being cancelled —
cancel it and an element caught mid-fade stays invisible.

**A reveal must not be able to strand content.** `ScrollReveal` hides
nothing until its own class is on `<html>`, and shows anything still hidden
after four seconds regardless. An observer only fires for an element that
crosses the viewport, and a tab never brought to the front crosses nothing.

---

## 8. The component vocabulary

`Page` · `Section` · `SectionHeader` · `Hero` · `MetricCard` · `DataTable`
· `InsightCard` · `EvidenceRow` · `SourceBadge` · `ConfidenceBadge` ·
`StatusPill` · `MarketStatus` · `ChartContainer` · `CompanyCard` ·
`EventCard` · `EmptyState` · `Band` · `Field` · `Quote` · `Delta` ·
`Meter` · `AiBlock` · `CompanyMark` · `Skeleton*`

**A page that needs something not here gets a new primitive in `ui.tsx`,
not a one-off block of classes.** That is the only reason the site reads as
one product.

`Hero` renders a photographic band when given `image`, and the quiet
heading when not. It once accepted `image`, was passed one by four pages,
and rendered it on none — the `<Image>` lived only in a `tone="dark"`
branch no page ever requested. Nine photographs sat committed, shipped and
invisible. **If you add a prop, render it or delete it.**

---

## 9. Nothing is left empty

An empty region is not minimalism, it is an unfinished thought. Two
failure shapes to watch for:

**A section that deletes itself.** One page lost its entire stock list when
a single quote request failed — the list silently emptied while the header
above went on announcing "0/0". Every data-driven section needs the
`Empty` primitive with a reason a reader can act on, not a bare dash.

**A heading with nothing under it.** If the data can be absent, the
heading has to be conditional too.

---

## 10. The entrance

The welcome gate is the one warm surface on the site, and the temperature
change is what makes crossing it feel like crossing a threshold.

Ground `#17120C`, mustard `#F3C53F`, burnt orange `#E0702F` on the cap and
beak only, brass `#B8914A`, cream `#F6EDDD`. Two blurred lights and a faint
dot grain — a perfectly smooth warm field is the most synthetic thing a
screen can show.

The button is the only way through. No skip link: a second, quieter way
past the door is the old entrance film's skip wearing different words.

Lock the scroll on **both** `body` and `documentElement` — body alone does
nothing here, and the page went on moving under a door meant to hold it
still.

---

## Working here

Read `CLAUDE.md` first — it holds the project's nine iron rules, and rules
5, 8 and 9 constrain visual work directly.

Verify in the browser rather than reasoning about the CSS. The pane this
site is usually tested in has two traps worth knowing: when it is hidden it
does not compute layout, so `getBoundingClientRect` returns zeros and
`getComputedStyle` returns stale values; and its animation clock does not
advance, so `requestAnimationFrame`, CSS animation progress and
`IntersectionObserver` all appear dead. **Measurements of zero and
animations that never progress are usually the pane, not the bug** — check
`document.hidden` before believing them, and fall back to a screenshot.

Stop the dev server before `npm run build`. They share `.next`, and a build
run underneath a live dev server leaves the page unable to hydrate, with a
cascade of 404s that looks exactly like a code fault and is not.
