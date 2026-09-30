"use client";

import { CinemaGate } from "./CinemaGate";

/**
 * The door in front of the GTA VI page.
 *
 * Two gates, not one, because the film was cut twice: portrait for a
 * phone and widescreen for everything else. A reel framed for a phone has
 * no business filling a desktop, and the reverse is worse — so each
 * screen gets the one shot for it, and only that one is downloaded.
 *
 * Four shots each now, joined the same way: the handover CinemaGate
 * already does for the site entrance, where
 * the finished clip stays on screen paused on its last frame and the next
 * is raised over it — so the join is a cut rather than a gap.
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
          { src: "/cinema/ttwo-gate-3.mp4" },
          { src: "/cinema/ttwo-gate-4.mp4" },
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
        shots={[
          { src: "/cinema/ttwo-desktop-1.mp4" },
          { src: "/cinema/ttwo-desktop-2.mp4" },
          { src: "/cinema/ttwo-desktop-3.mp4" },
          { src: "/cinema/ttwo-desktop-4.mp4" },
        ]}
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
