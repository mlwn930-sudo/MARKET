import { Page, Skeleton, SkeletonChart } from "@/components/ui";

/**
 * What a company page looks like while it is being built.
 *
 * Shaped like the page that is coming, not a spinner. This route fans out
 * to SEC filings, a quote, two years of candles, the sector medians, the
 * agent pipeline and the news store — on a cold cache it is the slowest
 * thing on the site, and a centred spinner for that long reads as a stall.
 *
 * The blocks are in the same order and at the same sizes as the real
 * masthead, quote and chart, so nothing jumps when the data lands. A
 * skeleton whose layout is wrong is worse than none: it promises a shape
 * and then moves it.
 *
 * Only the top of the page is drawn. Below the fold a skeleton is
 * pretending to know what is coming, and the analysis sections vary by
 * company — some have an expectation gap, some do not.
 */
export default function CompanyLoading() {
  return (
    <Page>
      <header className="border-b border-line pb-9 pt-12 sm:pt-16">
        <Skeleton className="h-3" width="160px" />

        <div className="mt-7 flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
          <div>
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-9 w-[3px] rounded-full" />
              <Skeleton className="h-10" width="280px" />
            </div>
            <Skeleton className="mt-4 h-3" width="220px" />
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-7" width="82px" />
              <Skeleton className="h-7" width="82px" />
              <Skeleton className="h-7" width="82px" />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-2.5" width="64px" />
                <Skeleton className="mt-2 h-6" width="88px" />
                <Skeleton className="mt-2 h-2" width="104px" />
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="gap-section">
        <Skeleton className="h-2.5" width="120px" />
        <Skeleton className="mt-4 h-7" width="420px" />

        <div className="surface mt-6 p-6">
          <Skeleton className="h-12" width="240px" />
          <Skeleton className="mt-4 h-5" width="150px" />
        </div>

        <div className="mt-4">
          <SkeletonChart height={360} />
        </div>
      </div>

      <p className="caption mt-10">
        נמשכים דוחות SEC, מחיר חי, שנתיים של נרות והשוואה לחציון הסקטור.
      </p>
    </Page>
  );
}
