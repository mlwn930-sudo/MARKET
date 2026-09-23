# Scheduled workflows

Everything on this site that changes on its own changes here. The app never
fetches slow data during a page request; these jobs write files, Vercel
redeploys on the push, and pages read the files.

## `refresh-news.yml` — every 20 minutes

1. Pulls the GDELT feed into `content/news/latest.json`.
2. Writes a Hebrew summary and impact analysis for any article that has none
   yet, into `content/news/summaries.json`.
3. Commits if either file changed.

Step 2 only touches new articles, so a normal cycle is a handful of model
calls rather than forty.

## `refresh-data.yml` — weekly, Sunday 04:00 UTC

Rebuilds the fundamentals universe and the 13F institutional holdings.

The cadence is weekly on purpose. Company filings change a few times a year
and 13F reports land quarterly, so a faster schedule would re-download
hundreds of megabytes from SEC to produce an identical file.

## Secrets

Set these under Settings → Secrets and variables → Actions.

| Secret | Needed by | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | news analysis | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free, no credit card |
| `FINNHUB_API_KEY` | weekly fundamentals | finnhub.io |
| `SEC_USER_AGENT` | weekly fundamentals and 13F | your own `Name email@example.com` |

**A missing `GEMINI_API_KEY` does not break anything.** The news feed still
refreshes; articles simply appear without analysis until the key is added.
That step is marked `continue-on-error` for the same reason — an unreachable
article should never stop the feed from updating.

## Two things that silently stop the schedule

1. **A private repository on a free GitHub account.** Scheduled workflows do
   not fire at all there. The repository has to be public, or the account on
   GitHub Pro.
2. **60 days without a commit.** GitHub disables scheduled workflows in
   dormant repositories. The refresh commits count as activity, so this only
   matters if the feed stops changing entirely.

The site shows a warning banner when the feed is more than two hours old,
which is the signal that one of the above happened.
