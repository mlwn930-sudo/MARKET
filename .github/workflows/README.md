# Scheduled workflows

`refresh-news.yml` pulls the GDELT feed every 20 minutes and commits
`content/news/latest.json`. Vercel redeploys on the push, so the site
always serves a recent feed without ever calling GDELT during a request.

Two things will silently stop this from running:

1. **A private repository on a free GitHub account.** Scheduled workflows
   do not fire at all there. The repository has to be public, or the
   account on GitHub Pro.
2. **60 days without a commit.** GitHub disables scheduled workflows in
   dormant repositories. The refresh commits count as activity, so this
   only matters if the feed stops changing entirely.

The site shows a warning banner when the feed is more than two hours old,
which is the signal that one of the above happened.

---

`refresh-data.yml` rebuilds the fundamentals universe and the 13F holdings
once a week. It needs two repository secrets:

| Secret | Value |
|---|---|
| `FINNHUB_API_KEY` | the Finnhub key |
| `SEC_USER_AGENT` | `<name> <email>` — SEC rejects requests without it |

Set them under Settings → Secrets and variables → Actions.

The cadence is weekly on purpose. Company filings change a few times a year
and 13F reports land quarterly, so a faster schedule would re-download
hundreds of megabytes from SEC to produce an identical file.
