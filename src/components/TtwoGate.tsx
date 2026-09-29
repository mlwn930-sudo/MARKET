"use client";

import { CinemaGate } from "./CinemaGate";

/**
 * The door in front of the GTA VI page.
 *
 * Two gates, not one, because there are two cuts of the film: a portrait
 * pair for a phone and a widescreen single for everything else. A reel
 * framed for a phone has no business filling a desktop, and the reverse
 * is worse — so each screen gets the one that was shot for it, and only
 * that one is ever downloaded.
 *
 * The phone cut runs in two clips. The handover is the one CinemaGate
 * already does for the site entrance: the finished clip stays on screen,
 * paused on its last frame, and the next is raised over it, so the join
 * is a cut rather than a gap.
 *
 * Both keep the same session key. Whichever screen a visitor arrives on,
 * passing the door once is enough — and passing the site's own entrance
 * does not open this one, because it has not been shown yet.
 */

const EYEBROW = "TAKE-TWO / GTA VI";
const TITLE: [string, string] = ["השקה אחת,", "שרשרת ערך שלמה."];
const READY: [string, string] = ["19 בנובמבר 2026.", "בואו נראה מה בפנים."];
const LEDE =
  "מה שהדוחות לא מכילים — תאריך שנמסר, נדחה פעמיים, ומנגנון שמזיז את ההכנסות.";
const KEY = "market-intel:ttwo-gate:v1";
const ACCENT = "#ff91cd";

export function TtwoGate() {
  return (
    <>
      <CinemaGate
        only="mobile"
        storageKey={KEY}
        shots={[
          { src: "/cinema/ttwo-gate.mp4" },
          { src: "/cinema/ttwo-gate-2.mp4" },
        ]}
        eyebrow={EYEBROW}
        title={TITLE}
        readyTitle={READY}
        lede={LEDE}
        enterLabel="לניתוח המלא"
        accent={ACCENT}
      />

      <CinemaGate
        only="desktop"
        storageKey={KEY}
        shots={[{ src: "/cinema/ttwo-desktop.mp4" }]}
        eyebrow={EYEBROW}
        title={TITLE}
        readyTitle={READY}
        lede={LEDE}
        enterLabel="לניתוח המלא"
        accent={ACCENT}
      />
    </>
  );
}
