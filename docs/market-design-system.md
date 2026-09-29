# MARKET design system · 27 September 2026

## Product direction

**WOW WHEN ENTERING → CLARITY WHEN USING → DEPTH WHEN RESEARCHING → TRUST WHEN DECIDING.**

The product follows **Data → Context → Intelligence → Thesis → Monitor**. Home and the Take-Two story have cinematic entrances. Research, company, macro and AI surfaces prioritize reading, comparison and source clarity. They share the same navigation, type, spacing, controls, semantic color and financial components.

The supplied images informed atmosphere, depth, and the transition from an editorial opening into useful data. Their layouts and embedded numbers were not copied. The homepage globe was removed from the rendering tree. Existing Spline files remain available in the repository but are not imported by Home.

## Foundations

| Role | Token / decision |
| --- | --- |
| Canvas | `#080f1b` |
| Surface / inset / raised | `#101b2b` / `#152236` / `#18263a` |
| Primary / secondary text | `#eef4fc` / `#bdcadd` |
| Muted / subtle text | `#93a6bf` / `#8194ad` |
| Borders | `#23334a` / `#344863` / `#536987` |
| Brand / actions | `#7da1ff` |
| Evidence and data series | `#6bd8ed` |
| Interpretation | `#b1a3ff` |
| Positive / negative direction | `#6bd5ac` / `#f28b99` |
| Event / caveat | `#e6bc76` |
| Interface / editorial / figures | Assistant / Frank Ruhl Libre / IBM Plex Mono |
| Layout | 1440px content ceiling; 32px desktop and 20px mobile gutters |
| Controls | 44px primary targets; visible keyboard focus; native input behavior |

Numbers retain tabular figures and explicit LTR isolation inside the Hebrew interface. Financial direction is not used as an atmospheric background tint. Section borders and whitespace establish hierarchy; every paragraph does not become another card.

`globals.css` owns semantic tokens and existing shared primitives. `market.css` owns the new editorial and analytical compositions. Components in `src/components/market/` contain the new reusable structures.

## Motion

| Level | Duration | Use |
| --- | --- | --- |
| Micro | 140ms | Hover, focus and control response |
| Product | 240ms | Route arrival line and chart selection settling |
| Story | 480ms | Headline arrival |
| Cinema | 900ms | Hero image entrance and editorial image hover |

Motion changes opacity and transform. It does not delay routing, animate financial values from invented starting points, hijack scrolling, or keep content hidden pending an observer. Chapter links are native anchors; an IntersectionObserver reflects reading position. Reduced-motion users receive the same content with the new animation and hover transforms disabled. Financial tables are stable while read.

## Page compositions

| Surface | Composition |
| --- | --- |
| Home | Skyline cover, real session chart selector, market pulse, live index/table, intelligence, events, TTWO story, screener/news/monitoring |
| GTA VI / TTWO | Story cover, legacy, sourced release, business bridge, accounting mechanics, expectations, risks, monitoring, financial evidence and thesis |
| Company | Compact company masthead, chapter navigation, evidence key, existing thesis/price/capital/financials/connections/news |
| Research | Compact heading, starter questions, streaming research console, evidence context and company entry points |
| Macro | Financial transmission context followed by comparable indicator rows with sources and timestamps |
| AI chat | Research framing, evidence key, explicit AI interpretation label and existing source-backed conversation |
| Other product pages | Shared dark tokens, readable headings, common header/search/mobile navigation and existing financial controls |

`CinematicHero`, `SignalCanvas`, `ChapterNav`, `EvidenceKey`, `WorkflowLinks` and `RouteTransition` are shared components. `Hero` is now a quiet product heading by default. Existing data providers, screener calculations, research streaming, chart controls, portfolio and watchlist storage remain in place.

## Data credibility

- The home signal chart uses actual supplied intraday closes. An unavailable series becomes an explicit empty state.
- The hero quote is a loading-time snapshot, with its own timestamp and Finnhub attribution. The intraday path is attributed separately to Yahoo. The existing market deck remains the updating surface.
- TTWO does not equate Net Bookings with GAAP revenue or cash collection. No invented sales forecast, target price or valuation-implied unit count is shown.
- The release date remains sourced from the existing canonical known-events record, including verification and postponement history.
- Unavailable SEC data is reported as unavailable. It does not become a failed company test or a replacement quantitative thesis.
- Research prompts are questions, not pre-written completed reports. AI interpretation is labeled separately from evidence.

## Responsive and accessibility behavior

The mobile hero changes composition instead of shrinking desktop text. Research side context stacks beneath the work area; macro rows become a two-column reading layout; workflow links become two columns. The mobile navigation retains five destinations and a safe-area inset. Chapter navigation scrolls horizontally. A skip link, visible focus, disclosure navigation and Escape behavior remain available without pointer interaction.

`/design-review` is a noindex, preview-only review surface. Its iframe creates real CSS viewports at 360, 390, 768, 1440 and 1920 pixels. Production returns 404 for this route. It is not linked from the product navigation.

## Assets and performance

Two original generated images were created for this implementation, then encoded as WebP:

- `market-city.webp`: blue-hour financial skyline with clear negative space for live HTML text; about 208 KiB.
- `ttwo-story.webp`: Miami-inspired sunset, two fictional protagonists and a coupe, with no baked-in text, logos or financial numbers; about 179 KiB.

Both use responsive Next Image rendering. Only the active page's hero has loading priority; the Home editorial teaser is lazy. No dependency was added. The first successful local production build reported 103 kB shared First Load JS, 138 kB for Home, and 242 kB for TTWO. These are bundle figures, not measured Lighthouse scores or real-user performance.

## Verification ledger

- TypeScript: passed during implementation.
- ESLint: passed during implementation.
- Production build: passed, 28 prerendered pages, after the SEC-unavailable recovery fix.
- Responsive/browser/interaction verification: in progress; final results will be recorded here before handoff.
- Production: no promotion performed.

## Source references

- GTA V release: https://www.rockstargames.com/newswire/article/o349k552518949/grand-theft-auto-v-now-available.html
- GTA VI release update: https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026
- The existing `known-events.ts` remains the product source of truth for the release event.

External design references were used for principles such as editorial scale, disciplined negative space and progressive storytelling, not for copied components or page layouts.
