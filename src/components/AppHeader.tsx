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
  const tools = path.startsWith("/research") || path.startsWith("/company") || path.startsWith("/compare")
    ? [["/research","מחקר חברה"],["/compare","השוואת חברות"],["/institutional","מוסדיים"],["/chat","ניתוח AI"]]
    : path.startsWith("/intel") || path.startsWith("/news")
      ? [["/news","חדשות והקשר"],["/ai","שרשרת AI"],["/macro","מאקרו"],["/learn","להבין את המושגים"]]
      : [["/heatmap","מפת השוק"],["/sectors","סקטורים"],["/macro","מאקרו"],["/news","חדשות"]];
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
        {/* GTA VI sits last on purpose. It is a story, not a destination
            like the four before it, and it was reachable only from the
            row below and from inside the drawer — present but buried.
            Last in the row is visible without competing. */}
        {[['/', 'שווקים'], ['/intel', 'מודיעין'], ['/research', 'מחקר'], ['/opportunities', 'הזדמנויות'], ['/watchlist', 'מעקב'], ['/launch/ttwo', 'GTA VI']].map(([href,label]) => <Link key={href} href={href} className={href === '/launch/ttwo' ? 'destination-story' : undefined} aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}>{label}</Link>)}
      </div>
      <div className="nav-utilities">
        <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))} aria-label="חיפוש חברה או כלי"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5"/></svg><span>חיפוש</span></button>
        <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="כל הכלים" aria-controls="market-explore" className="explore-trigger"><span>כל הכלים</span><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 13h14" stroke="currentColor" strokeWidth="1.5"/></svg></button>
      </div>
    </nav>
    <nav className="financial-subnav" aria-label="כלי מחקר מהירים"><span className="nav-context-label">לחקור את השוק</span>{tools.map(([href,label])=><Link key={href} href={href} aria-current={path===href?"page":undefined}>{label}</Link>)}<Link className="stories-nav" href="/launch/ttwo">סיפורי MARKET <span>GTA VI ↗</span></Link></nav>
    <dialog ref={dialog} id="market-explore" className="explore-dialog" onCancel={close} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) close(); }} aria-labelledby="explore-heading">
      <div className="explore-sheet">
        <div className="explore-heading"><div><span className="micro-label">THE RESEARCH DESK</span><h2 id="explore-heading">לאן ממשיכים?</h2></div><button type="button" autoFocus onClick={close} aria-label="סגירת התפריט">✕</button></div>
        <div className="world-guide">{[["01","מה קורה עכשיו?","מדדים, חברות ומפת השוק","/"],["02","מה עומד מאחורי זה?","אירועים ושרשראות השפעה","/intel"],["03","מה כדאי לבדוק?","דוחות, השוואה ותזה","/research"]].map(([n,title,text,href])=><Link key={n} href={href} onClick={close}><span>{n}</span><strong>{title}</strong><small>{text} ←</small></Link>)}</div>
        <div className="explore-groups">{groups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.links.map(([href, label]) => <Link key={href} href={href} onClick={close} aria-current={path === href ? "page" : undefined}>{label}<span aria-hidden="true">↖</span></Link>)}</section>)}</div><div className="explore-stories"><span>סיפורים פיננסיים לעומק</span><Link href="/launch/ttwo" onClick={close}>GTA VI / Take-Two ↖</Link><Link href="/learn" onClick={close}>חדש בשוק? מתחילים כאן ←</Link></div>
      </div>
    </dialog>
  </header>;
}
