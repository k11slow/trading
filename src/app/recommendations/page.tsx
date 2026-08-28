import type { Metadata } from "next";
import { RecommendedBuysPage } from "@/components/RecommendedBuysPage";

export const metadata: Metadata = {
  title: "Recommended Buys — AI Trading",
  description: "Live all-market intraday buy recommendations",
};

export default function Page() {
  return <RecommendedBuysPage />;
}
