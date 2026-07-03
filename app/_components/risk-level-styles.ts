import type { RiskLevel } from "@/lib/risk-level";

export type RiskLevelStyle = {
  badge: string;
  dot: string;
  text: string;
};

export const RISK_LEVEL_STYLES: Record<RiskLevel, RiskLevelStyle> = {
  warning: {
    badge: "bg-error/10 text-error border-error/20",
    dot: "bg-error",
    text: "text-error",
  },
  watch: {
    badge: "bg-earth/10 text-earth border-earth/20",
    dot: "bg-earth",
    text: "text-earth",
  },
  clear: {
    badge: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
    text: "text-success",
  },
  unknown: {
    badge: "bg-ink/[0.04] text-ink-muted border-border",
    dot: "bg-ink-muted",
    text: "text-ink-muted",
  },
};
