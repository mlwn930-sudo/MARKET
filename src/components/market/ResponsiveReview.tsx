"use client";

import { useState } from "react";

const ROUTES = [
  ["/", "בית"], ["/launch/ttwo", "GTA VI"], ["/company/NVDA", "חברה"],
  ["/research", "מחקר"], ["/macro", "מאקרו"], ["/chat", "AI"],
  ["/news", "חדשות"], ["/watchlist", "מעקב"], ["/portfolio", "תיק"],
  ["/opportunities", "הזדמנויות"], ["/intel", "מודיעין"],
] as const;

/** The iframe provides actual CSS viewports, including media-query behavior. */
export function ResponsiveReview() {
  const [width, setWidth] = useState(390);
  const [route, setRoute] = useState("/");
  return <main id="main-content" className="p-5" tabIndex={-1}>
    <h1 className="text-2xl">MARKET · בדיקת תצוגה</h1>
    <p className="mt-2 text-sm text-ink-muted">סביבת בדיקה בגרסת התצוגה בלבד. התוכן במסגרת הוא האתר עצמו ברוחב שנבחר.</p>
    <div className="my-5 flex flex-wrap items-center gap-3">
      <label htmlFor="review-page">עמוד</label>
      <select id="review-page" value={route} onChange={(event) => setRoute(event.target.value)} className="field w-auto">
        {ROUTES.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
      </select>
      {[360, 390, 768, 1440, 1920].map((value) => <button key={value} className="btn btn-ghost num" type="button" aria-pressed={width === value} onClick={() => setWidth(value)}>{value}px</button>)}
      <span role="status" className="num text-sm text-ink-muted">{width} × 850</span>
    </div>
    <div className="overflow-x-auto border border-line p-3" dir="ltr">
      <iframe title="MARKET responsive viewport" src={route} style={{ width, height: 850, border: 0, display: "block", margin: "auto", maxWidth: "none" }} />
    </div>
  </main>;
}
