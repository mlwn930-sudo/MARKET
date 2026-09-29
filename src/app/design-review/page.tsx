import { notFound } from "next/navigation";
import { ResponsiveReview } from "@/components/market/ResponsiveReview";

export const dynamic = "force-dynamic";
export const metadata = { title: "MARKET · Design review", robots: { index: false, follow: false } };

/** A review surface on preview deployments; never available in production. */
export default function DesignReviewPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  return <ResponsiveReview />;
}
