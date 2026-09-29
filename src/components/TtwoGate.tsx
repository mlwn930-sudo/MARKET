"use client";

import { CinemaGate } from "./CinemaGate";

/**
 * The door in front of the GTA VI page, on a phone.
 *
 * The clip was cut for a portrait screen, so it only runs on one: a reel
 * framed for a phone has no business filling a desktop. On a wide screen
 * this renders nothing visible and downloads nothing, and the site's own
 * entrance stands in its place.
 *
 * It keeps its own session key. Coming in through the front door does not
 * open this one, because it has not been shown yet.
 */
export function TtwoGate() {
  return (
    <CinemaGate
      only="mobile"
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
