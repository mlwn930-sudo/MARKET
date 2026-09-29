"use client";

import { CinemaGate } from "./CinemaGate";

/**
 * The door in front of the GTA VI page.
 *
 * The clip runs in full — eight seconds, sound and all. An earlier
 * version was cut at 2.85s to stop before the dialogue; this one is meant
 * to be heard, so there is no `until` here and the reel plays to its own
 * end.
 *
 * Passing the site's entrance does not open this one. They keep separate
 * keys, because someone who came in through the front door has not yet
 * been shown this.
 */
export function TtwoGate() {
  return (
    <CinemaGate
      storageKey="market-intel:ttwo-gate:v1"
      shots={[{ src: "/cinema/ttwo-gate.mp4" }]}
      eyebrow="TAKE-TWO / GTA VI"
      title={["השקה אחת,", "שרשרת ערך שלמה."]}
      readyTitle={["19 בנובמבר 2026.", "בואו נראה מה בפנים."]}
      lede="מה שהדוחות לא מכילים — תאריך שנמסר, נדחה פעמיים, ומנגנון שמזיז את ההכנסות."
      enterLabel="לניתוח המלא"
      accent="#ff91cd"
    />
  );
}
