"use client";

import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";
import type { RegionRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_STYLES } from "./risk-level-styles";

interface Props {
  regionCode: string;
  summaries: RegionRiskSummary[];
}

export default function RegionRiskChip({ regionCode, summaries }: Props) {
  const summary = summaries.find((item) => item.code === regionCode);

  if (!summary) {
    return null;
  }

  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${style.badge}`}
      aria-label={`Current risk for ${summary.name}: ${label}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {summary.level === "unknown"
        ? "Risk unavailable"
        : `${label} risk now`}
    </span>
  );
}

// Re-export the type so server callers can keep imports local.
export type { RiskLevel };
