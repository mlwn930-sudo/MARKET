import Link from "next/link";

export function WorkflowLinks({ ticker, title = "מכאן ממשיכים למחקר" }: { ticker?: string; title?: string }) {
  const links = ticker ? [
    { href: "/company/" + ticker, label: "החברה", note: "דוחות, מחיר ותמחור" },
    { href: "/research?ticker=" + ticker, label: "המחקר", note: "לבחון את ההנחות" },
    { href: "/chat?q=" + encodeURIComponent("מה יכול לשנות את התזה של " + ticker + "?"), label: "התזה", note: "ראיות מול אי־ודאות" },
    { href: "/watchlist", label: "המעקב", note: "לראות מה השתנה" },
  ] : [
    { href: "/news", label: "מה קרה", note: "חדשות והקשר" },
    { href: "/opportunities", label: "למי זה משנה", note: "חברות וסקטורים" },
    { href: "/research", label: "מה התזה", note: "לחקור את הראיות" },
    { href: "/watchlist", label: "מה הלאה", note: "רשימת המעקב" },
  ];
  return <section className="workflow" aria-label={title}>
    <div className="workflow-label"><span className="micro-label">CONTINUE THE RESEARCH</span><h2>{title}</h2></div>
    <div className="workflow-links">{links.map((link, index) => <Link href={link.href} key={link.href}><span className="num workflow-number">0{index + 1}</span><strong>{link.label}</strong><span>{link.note}</span><span className="workflow-arrow" aria-hidden="true">←</span></Link>)}</div>
  </section>;
}
