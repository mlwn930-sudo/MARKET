import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";

/**
 * Who has asked for alerts, and who the owner has approved.
 *
 * WHY NOT A FILE. Everything else durable in this project is a JSON file a
 * scheduled job rewrites and commits — fundamentals, institutional
 * holdings, the news feed, the scan. That pattern is right for market data
 * and wrong for this. An email address committed to git is in the history
 * for good: deleting the line later removes it from the working tree and
 * leaves it in every clone and every past commit. Addresses belong in a
 * store that can actually forget them.
 *
 * WHY RAW SQL. Drizzle is in the project's dependencies, but one table
 * does not earn a schema directory and a migration runner. The table is
 * created on demand, which also means a fresh database needs no setup step
 * anybody has to remember.
 *
 * WHEN THERE IS NO DATABASE. `DATABASE_URL` is empty today, and the door
 * must not become a wall because of it. Every function here reports that
 * state instead of throwing, the API turns it into a clear answer, and the
 * gate lets the reader in while saying alerts are not switched on yet. A
 * sign-up form that silently drops the address would be worse than no form
 * at all.
 */

export type SubscriberState = "pending" | "approved" | "blocked";

export type StoreResult =
  | { ok: true; state: SubscriberState; token: string | null; fresh: boolean }
  | { ok: false; reason: "no-database" | "failed" };

function db() {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) return null;
  return neon(url);
}

/** Addresses are stored lowercase and trimmed so one person cannot occupy
 *  three rows by capitalising differently. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  /* Deliberately permissive. The real proof that an address works is that
     mail sent to it arrives, and the approval step already provides that.
     A clever regex here only rejects valid unusual addresses. */
  if (email.length < 6 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** The approval link carries this, never the address itself: a link in the
 *  owner's inbox should not leak a subscriber's email into browser history,
 *  a referrer header or a screenshot. */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Stored hashed. A leaked database should not hand over working approval
 *  links, the same reason a password is never stored as written. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureTable(sql: NonNullable<ReturnType<typeof db>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS alert_subscribers (
      email       TEXT PRIMARY KEY,
      state       TEXT NOT NULL DEFAULT 'pending',
      token_hash  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at  TIMESTAMPTZ
    )
  `;
}

/**
 * Records a request for alerts and returns the token the owner's approval
 * link needs.
 *
 * Re-submitting an address that is already there does not reset it: an
 * approved reader stays approved, and a blocked one cannot clear the block
 * by signing up again. Only a pending row gets a fresh token, so a lost
 * approval mail can be resent.
 */
export async function requestAlerts(email: string): Promise<StoreResult> {
  const sql = db();
  if (!sql) return { ok: false, reason: "no-database" };

  try {
    await ensureTable(sql);

    const existing = (await sql`
      SELECT state FROM alert_subscribers WHERE email = ${email}
    `) as { state: SubscriberState }[];

    if (existing.length > 0 && existing[0].state !== "pending") {
      return { ok: true, state: existing[0].state, token: null, fresh: false };
    }

    const token = newToken();
    await sql`
      INSERT INTO alert_subscribers (email, state, token_hash)
      VALUES (${email}, 'pending', ${hash(token)})
      ON CONFLICT (email) DO UPDATE SET token_hash = ${hash(token)}
    `;
    return {
      ok: true,
      state: "pending",
      token,
      fresh: existing.length === 0,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * The owner's decision, from the link in their inbox.
 *
 * The token is matched against the hash rather than the address, so the
 * link proves the owner received the mail this project sent — guessing an
 * address is not enough to approve it.
 */
export async function decide(
  token: string,
  verdict: "approved" | "blocked",
): Promise<{ ok: boolean; email: string | null }> {
  const sql = db();
  if (!sql) return { ok: false, email: null };

  try {
    await ensureTable(sql);
    const rows = (await sql`
      UPDATE alert_subscribers
         SET state = ${verdict}, decided_at = now(), token_hash = NULL
       WHERE token_hash = ${hash(token)} AND state = 'pending'
       RETURNING email
    `) as { email: string }[];
    return { ok: rows.length > 0, email: rows[0]?.email ?? null };
  } catch {
    return { ok: false, email: null };
  }
}

/** Everyone the owner has approved. The only list alerts are ever sent to. */
export async function approvedSubscribers(): Promise<string[]> {
  const sql = db();
  if (!sql) return [];
  try {
    await ensureTable(sql);
    const rows = (await sql`
      SELECT email FROM alert_subscribers WHERE state = 'approved'
    `) as { email: string }[];
    return rows.map((r) => r.email);
  } catch {
    return [];
  }
}

/**
 * Removal, on request.
 *
 * Someone who gave an address to read a page is entitled to take it back,
 * and the row is deleted rather than flagged — a store that keeps what it
 * was asked to forget has not forgotten it.
 */
export async function forget(email: string): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await ensureTable(sql);
    await sql`DELETE FROM alert_subscribers WHERE email = ${email}`;
    return true;
  } catch {
    return false;
  }
}

/** Whether alerts are switched on at all, for the interface to say so
 *  plainly rather than taking an address it cannot store. */
export function alertsConfigured(): boolean {
  return db() !== null;
}

/* ------------------------------------------------------------------ */
/* What each subscriber follows                                        */
/* ------------------------------------------------------------------ */

/**
 * The watchlist, server side.
 *
 * It already exists in localStorage, and that was the right call while
 * there was no database: a watchlist is the smallest piece of personal
 * state and the reader's own machine is the cheapest place for it.
 *
 * Alerts break that. The scheduled job runs on a GitHub runner with no
 * browser and no access to anybody's localStorage, so "only tell me about
 * the companies I follow" cannot be answered there unless the following is
 * recorded somewhere the job can read.
 *
 * So this is a copy, not a move. The browser list stays exactly as it is
 * and keeps working for someone who never gives an address; this table is
 * what the mail is addressed from. They are kept in step by the follow
 * route, and when they disagree the browser wins — it is the one the
 * reader is actually looking at.
 */

async function ensureWatchTable(sql: NonNullable<ReturnType<typeof db>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS alert_watchlist (
      email    TEXT NOT NULL,
      ticker   TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (email, ticker)
    )
  `;
}

export async function follow(email: string, ticker: string): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await ensureWatchTable(sql);
    await sql`
      INSERT INTO alert_watchlist (email, ticker)
      VALUES (${email}, ${ticker.toUpperCase()})
      ON CONFLICT (email, ticker) DO NOTHING
    `;
    return true;
  } catch {
    return false;
  }
}

export async function unfollow(email: string, ticker: string): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await ensureWatchTable(sql);
    await sql`
      DELETE FROM alert_watchlist
       WHERE email = ${email} AND ticker = ${ticker.toUpperCase()}
    `;
    return true;
  } catch {
    return false;
  }
}

export async function watchedBy(email: string): Promise<string[]> {
  const sql = db();
  if (!sql) return [];
  try {
    await ensureWatchTable(sql);
    const rows = (await sql`
      SELECT ticker FROM alert_watchlist WHERE email = ${email} ORDER BY ticker
    `) as { ticker: string }[];
    return rows.map((r) => r.ticker);
  } catch {
    return [];
  }
}

/**
 * Every approved subscriber with what they follow, in one read.
 *
 * The sender needs this for all of them at once, and a query per person
 * would be a round trip per person on a connection that sleeps between
 * runs. An approved subscriber who follows nothing comes back with an
 * empty array rather than being dropped — the sender decides what that
 * means, and the answer it gives is "nothing to send you yet", not
 * "everything".
 */
export async function approvedWithWatchlists(): Promise<
  { email: string; tickers: string[] }[]
> {
  const sql = db();
  if (!sql) return [];
  try {
    await ensureTable(sql);
    await ensureWatchTable(sql);
    const rows = (await sql`
      SELECT s.email, COALESCE(w.ticker, NULL) AS ticker
        FROM alert_subscribers s
        LEFT JOIN alert_watchlist w ON w.email = s.email
       WHERE s.state = 'approved'
    `) as { email: string; ticker: string | null }[];

    const byEmail = new Map<string, string[]>();
    for (const row of rows) {
      const list = byEmail.get(row.email) ?? [];
      if (row.ticker) list.push(row.ticker);
      byEmail.set(row.email, list);
    }
    return [...byEmail].map(([email, tickers]) => ({ email, tickers }));
  } catch {
    return [];
  }
}
