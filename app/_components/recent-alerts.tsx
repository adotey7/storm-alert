import { Radio } from "lucide-react";
import type { RecentAlert } from "@/lib/alert-stats";

interface Props {
  alerts: RecentAlert[];
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function RecentAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <p className="text-[14px] text-ink-muted">
        No alerts triggered yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-canvas px-3 py-2.5"
        >
          <Radio
            size={15}
            className="mt-0.5 shrink-0 text-earth"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-ink-secondary">
              {alert.triggerReason}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {alert.regionCode} · {alert.recipientsCount} notified ·{" "}
              {formatRelative(alert.triggeredAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
