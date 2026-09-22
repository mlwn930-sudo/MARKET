import Link from "next/link";

const LINKS = [
  { href: "/", label: "דשבורד" },
  { href: "/opportunities", label: "הזדמנויות" },
  { href: "/institutional", label: "מעקב מוסדי" },
  { href: "/news", label: "חדשות" },
  { href: "/learn", label: "מרכז ידע" },
];

export function SiteNav() {
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-5 px-6 py-3">
        <Link href="/" className="font-serif text-sm text-gold">
          Market Intel
        </Link>
        <div className="flex gap-4 text-xs text-ink-muted">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
