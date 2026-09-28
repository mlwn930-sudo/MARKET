# MARKET — living financial research

## Starting point

Reviewed the supplied Vercel preview and both WhatsApp reference videos. The preview corresponds to `codex/market-design-system`, not `main`. The implementation preserves that branch's research components and incorporates the newer news refresh from main.

The 15.8-second food reference keeps one product as an anchor, separates its layers, assembles a larger meal, and resolves into a usable catalog. The 20-second architecture reference moves through a server room, reveals a site's construction layers, and changes scale from landscape to building to interior. Both use continuous visual relationships, readable pauses, and purposeful changes in scale. Their branding, assets, and compositions were not copied.

## Implemented direction

- Three primary destinations: discovery, GTA VI / Take-Two, research. Search and all existing tools remain accessible. The native navigation dialog supports focus containment and Escape.
- Restrained ink, paper, and copper surfaces. Home leads with one invitation, an editorial flagship, a spatial research sequence, then real market data with deeper tables on request.
- GSAP/ScrollTrigger controls layered depth and the pinned desktop GTA sequence. No scroll hijacking or WebGL dependency. The scene transforms the game world into the publisher and shareholder perspective.
- At narrow widths, the story is a normal reading flow. A native chapter selector replaces the desktop chapter strip; a three-item bottom navigation remains thumb-accessible.
- Reduced-motion and no-JavaScript visitors can read every narrative chapter. Effects clean up on navigation and viewport changes.
- Existing company analysis, charts, comparisons, opportunities, news, and watchlists remain available. The flagship contains explicit unavailable-data states rather than fabricated values.
- The sensitivity lab is a teaching model: units × realized price × (1 − assumed distribution fee). It is not GAAP revenue, Net Bookings, profit, FCF, a share-price target, or a company forecast.
- A personal thesis records a proposition, disconfirming evidence, and monitoring questions. It is saved locally and displayed in the watchlist. Failed storage is reported; no cross-device sync or automatic notifications are implied.

## Editorial evidence and assets

Verified 2026-09-28:

- [Take-Two Q1 FY2027 results, published August 7, 2026](https://www.take2games.com/ir/news/take-two-interactive-software-inc-reports-results-fiscal-first-6): company-wide quarterly results, recurrent spending mix, annual Net Bookings guidance, and announced GTA VI release date. The page labels both reporting period and forecast scope. Snapshot facts require editorial review when a new filing arrives.
- [Rockstar's world and characters](https://www.rockstargames.com/VI/only-in-leonida).
- [Official artwork gallery](https://www.rockstargames.com/VI/media/artwork-wallpapers): Jason and Lucia 01; Vice City Postcard. Local WebP derivatives preserve the original artwork; © Rockstar Games. Used with attribution in independent editorial coverage, not presented as MARKET-created art or an official affiliation.

The pre-existing generated GTA illustration is no longer used on the home or flagship route. No reference video footage was incorporated into the product.

## Reproducing validation

```sh
npm ci
npm run typecheck
npm run lint
npm run test:scenario
npm run build
npm run start
# In another terminal, using installed Chrome:
npm run test:journey
```

`MARKET_TEST_URL` selects a different local or preview origin. `PLAYWRIGHT_CHANNEL` defaults to `chrome`. The tests verify scenario arithmetic, save/reload/watchlist handoff, menu focus and Escape, mobile overflow at 320/390/768px, reduced motion, denied storage, and no-JavaScript story content. Browser images were additionally reviewed at 1440×1000 and 390×844.

Live quotes and SEC-derived analysis depend on the deployment's existing environment configuration. Local verification intentionally used missing-credential states; it does not certify provider uptime. Financial snapshots include sources and dates, and do not substitute for live quotes.
