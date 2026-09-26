import Link from "next/link";
import type { CompanyGraph, Connection } from "@/lib/intel/graph";
import { GradeChip, DerivedMark } from "./SignalCard";

/**
 * Everything this company is attached to.
 *
 * Not a force-directed picture of nodes and springs. That shape looks
 * like intelligence and behaves like wallpaper: nothing in it can be
 * clicked with intent, the labels collide at any real density, and it
 * cannot carry the one thing that makes a connection worth drawing —
 * the sentence explaining why it is there.
 *
 * So it is an index. Grouped by the question each group answers, ordered,
 * and every row carries its relation, its reason and how well evidenced
 * that reason is. A macro link is graded "speculative" and says so
 * plainly, right next to a sector link graded "confirmed", which is the
 * comparison the reader needs and a diagram would have flattened.
 */

function Row({ connection }: { connection: Connection }) {
  const external = connection.href?.startsWith("http");

  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[13px] leading-snug text-ink">
          {connection.label}
        </span>
        {connection.figure && (
          <span className="num text-[11px] text-ink-muted">
            {connection.figure}
          </span>
        )}
        <span className="badge">{connection.relation}</span>
        <span className="ms-auto shrink-0">
          <GradeChip grade={connection.grade} />
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        {connection.why}
      </p>
    </>
  );

  if (!connection.href) {
    return <div className="px-5 py-3.5">{body}</div>;
  }

  return external ? (
    <a
      href={connection.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-5 py-3.5 transition-colors hover:bg-raised/40"
    >
      {body}
    </a>
  ) : (
    <Link
      href={connection.href}
      className="block px-5 py-3.5 transition-colors hover:bg-raised/40"
    >
      {body}
    </Link>
  );
}

export function ConnectionIndex({ graph }: { graph: CompanyGraph }) {
  return (
    <div className="space-y-4">
      {graph.groups.map((group) => (
        <section key={group.kind} className="surface overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <DerivedMark title="חוברו בקוד מנתונים שהעמוד כבר טען" />
              <h3 className="text-[13px] font-medium text-ink">{group.label}</h3>
              <span className="num text-[11px] text-ink-ghost">
                {group.connections.length}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-ink-faint">
              {group.summary}
            </p>
          </div>

          <div className="divide-y divide-line">
            {group.connections.map((connection) => (
              <Row key={connection.id} connection={connection} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
