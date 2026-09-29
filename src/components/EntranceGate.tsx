"use client";

import { usePathname } from "next/navigation";
import { CinemaGate } from "./CinemaGate";

/** Pages that bring a door of their own — but only on a phone, which is
 *  the only screen their reel was cut for. On a wide screen this one
 *  still stands there. */
const OWN_GATE_ON_MOBILE = ["/launch/"];

/** The site's own door. The behaviour lives in CinemaGate; this is the
 *  reel and the words. */
export function EntranceGate() {
  const path = usePathname();
  const yields = OWN_GATE_ON_MOBILE.some((prefix) => path?.startsWith(prefix));
  return (
    <CinemaGate
      only={yields ? "desktop" : undefined}
      storageKey="market-intel:entered:v1"
      shots={[
        { src: "/cinema/01-entrance.mp4" },
        { src: "/cinema/02-hall.mp4" },
      ]}
      eyebrow="MARKET INTEL"
      title={["מודיעין פיננסי,", "לפני שהשוק מדבר."]}
      readyTitle={["הדלת פתוחה.", "היכנסו."]}
      lede="נתונים רשמיים, מחקר מבוסס מקורות, וזירה אחת שמחברת ביניהם."
      enterLabel="לכניסה לאתר"
    />
  );
}
