"use client";

import dynamic from "next/dynamic";
import type { RegionRiskSummary, CatchmentRiskSummary } from "@/lib/live-risk";

const CoverageMap = dynamic(() => import("./coverage-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-border bg-ink/[0.02] text-[13px] text-ink-muted">
      Loading map…
    </div>
  ),
});

interface Props {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
}

export default function CoverageMapLoader(props: Props) {
  return <CoverageMap {...props} />;
}
