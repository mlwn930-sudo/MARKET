"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMMAND_EVENT } from "./CommandCenter";
import { Wordmark } from "./Wordmark";
const groups = [
  { title: "להבין את השוק", links: [["/brief", "התדריך"], ["/news", "חדשות והקשר"], ["/heatmap", "מפת השוק"], ["/sectors", "סקטורים"], ["/macro", "מאקרו"], ["/israel", "תל אביב"]] },
  { title: "לחקור רעיון", links: [["/intel", "חדר המודיעין"], ["/opportunities", "סורק הזדמנויות"], ["/research", "מחקר עומק"], ["/compare", "השוואת חברות"], ["/institutional", "משקיעים מוסדיים"], ["/ai", "שרשרת ה־AI"]] },
  { title: "לבנות עמדה", links: [["/watchlist", "רשימת המעקב"], ["/portfolio", "בניית תיק"], ["/chat", "שיחה על השוק"], ["/learn", "מילון ומדריכים"]] },
];
export function AppHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const node = dialog.current;
    if (open) node?.showModal(); else if (node?.open) node.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <header className="studio-header">
    <nav aria-label="ראשי" className="studio-nav">
      <Link href="/" aria-label="MARKET — בית"><Wordmark /></Link>
      <div className="primary-destinations">
        <Link href="/" aria-current={path === "/" ? "page" : undefined}>לגלות</Link>
        <Link href="/launch/ttwo" className="gta-destination" aria-current={path.startsWith("/launch/ttwo") ? "page" : undefined}><bdi>GTA VI</bdi><span> / Take-Two</span></Link>
        <Link href="/research" aria-current={path.startsWith("/research") || path.startsWith("/company/") ? "page" : undefined}>מחקר</Link>
      </div>
      <div className="nav-utilities">
        <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))} aria-label="חיפוש חברה או כלי"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5"/></svg><span>חיפוש</span></button>
        <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="כל הכלים" aria-controls="market-explore" className="explore-trigger"><span>כל הכלים</span><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 13h14" stroke="currentColor" strokeWidth="1.5"/></svg></button>
      </div>
    </nav>
    <dialog ref={dialog} id="market-explore" className="explore-dialog" onCancel={close} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) close(); }} aria-labelledby="explore-heading">
      <div className="explore-sheet">
        <div className="explore-heading"><div><span className="micro-label">THE RESEARCH DESK</span><h2 id="explore-heading">לאן ממשיכים?</h2></div><button type="button" autoFocus onClick={close} aria-label="סגירת התפריט">✕</button></div>
        <Link className="explore-feature" href="/launch/ttwo" onClick={close}><bdi>GTA VI / TAKE-TWO</bdi><span>מהסיפור אל ההשקעה ←</span></Link>
        <div className="explore-groups">{groups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.links.map(([href, label]) => <Link key={href} href={href} onClick={close} aria-current={path === href ? "page" : undefined}>{label}<span aria-hidden="true">↖</span></Link>)}</section>)}</div>
      </div>
    </dialog>
  </header>;
}
