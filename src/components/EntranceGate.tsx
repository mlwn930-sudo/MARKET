"use client";

import { usePathname } from "next/navigation";
import { CinemaGate } from "./CinemaGate";

/** Pages that bring their own door. Two in a row is one too many, and
 *  the specific one is the better of the pair for the visitor who asked
 *  for that page. */
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
        { src: "/cinema/02-hall.mp4" },
        /* The hall of products: the subject runs along both edges, so a
           portrait crop removes exactly the thing it is there to show. */
        { src: "/cinema/03-companies.mp4", wideOnMobile: true },
      ]}
      eyebrow="MARKET INTEL"
      title={["מודיעין פיננסי,", "לפני שהשוק מדבר."]}
      readyTitle={["הדלת פתוחה.", "היכנסו."]}
      lede="נתונים רשמיים, מחקר מבוסס מקורות, וזירה אחת שמחברת ביניהם."
      enterLabel="לכניסה לאתר"
    />
  );
}
