"use client";

import { usePathname } from "next/navigation";
import { CinemaGate } from "./CinemaGate";

/** Pages that bring a door of their own, on every screen now that the
 *  launch film has been cut both ways. Two in a row is one too many, and
 *  for someone who asked for that page the specific one is the better of
 *  the pair. */
const HAS_OWN_GATE = ["/launch/"];

/** The site's own door. The behaviour lives in CinemaGate; this is the
 *  reel and the words. */
export function EntranceGate() {
  const path = usePathname();
  if (HAS_OWN_GATE.some((prefix) => path?.startsWith(prefix))) return null;

  return (
    <CinemaGate
      storageKey="market-intel:entered:v1"
      shots={[
        { src: "/cinema/01-entrance.mp4" },
        /* Stops before the dissolve.
           The file runs 3.04s, but at 1.83 it begins mixing into a third
           room — the product gallery — and ends there. That is the room
           that kept appearing after its clip was deleted: it was never in
           that clip, it was inside this one. Sampled frame by frame, 1.832
           is the last one that is purely the trading floor, so the film
           ends on the push forward and goes straight to the site. */
        { src: "/cinema/02-hall.mp4", until: 1.82 },
      ]}
      eyebrow="MARKET INTEL"
      title={["מודיעין פיננסי,", "לפני שהשוק מדבר."]}
      readyTitle={["הדלת פתוחה.", "היכנסו."]}
      lede="נתונים רשמיים, מחקר מבוסס מקורות, וזירה אחת שמחברת ביניהם."
      enterLabel="לכניסה לאתר"
    />
  );
}
