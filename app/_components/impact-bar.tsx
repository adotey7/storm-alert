import { Users, Bell, MapPinned, Clock } from "lucide-react";
import type { AlertStats } from "@/lib/alert-stats";

interface Props {
  stats: AlertStats;
  regionsCovered: number;
  evaluatedAt: string;
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-ink-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="text-lg font-bold text-ink">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export default function ImpactBar({ stats, regionsCovered, evaluatedAt }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-canvas px-5 py-4 sm:grid-cols-4">
      <Stat
        icon={<Users size={16} />}
        value={stats.activeSubscribers.toLocaleString()}
        label="Subscribers"
      />
      <Stat
        icon={<Bell size={16} />}
        value={stats.alertsSent.toLocaleString()}
        label="Alerts sent"
      />
      <Stat
        icon={<MapPinned size={16} />}
        value={String(regionsCovered)}
        label="Regions"
      />
      <Stat
        icon={<Clock size={16} />}
        value={formatRelative(evaluatedAt)}
        label="Checked"
      />
    </div>
  );
}
