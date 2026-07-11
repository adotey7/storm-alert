import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";
import type { RegionRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_STYLES } from "./risk-level-styles";

interface Props {
  summary: RegionRiskSummary;
}

export default function RegionRiskCard({ summary }: Props) {
  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <Link
      href={`/region/${summary.code}`}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-canvas px-4 py-3 transition-colors hover:border-ink-muted focus-visible:rounded-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-ink">
          {summary.name}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className={`text-[13px] font-medium ${style.text}`}>{label}</span>
      </div>
    </Link>
  );
}

export type { RiskLevel };
