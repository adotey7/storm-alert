import Link from "next/link";
import { CloudLightning, MapPinned } from "lucide-react";
import { getLiveRiskSummary } from "@/lib/live-risk";
import { getAlertStats, getRecentAlerts } from "@/lib/alert-stats";
import { RISK_LEVEL_LABELS } from "@/lib/risk-level";
import RegionRiskCard from "@/app/_components/region-risk-card";
import RecentAlerts from "@/app/_components/recent-alerts";
import ImpactBar from "@/app/_components/impact-bar";
import { RISK_LEVEL_STYLES } from "@/app/_components/risk-level-styles";

export const dynamic = "force-dynamic";
// Force dynamic: the page reads live (cached, but revalidating) weather data
// and DB stats; we never want a stale static prerender here.

export default async function AlertsPage() {
  const [summary, stats, recentAlerts] = await Promise.all([
    getLiveRiskSummary(),
    getAlertStats(),
    getRecentAlerts(8),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <div className="mb-8 w-full text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Live Storm Dashboard
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-secondary">
            Current storm and flood-risk across Ghana.
          </p>
        </div>

        <div className="mb-8 w-full">
          <ImpactBar
            stats={stats}
            regionsCovered={summary.regions.length}
            evaluatedAt={summary.evaluatedAt}
          />
        </div>

        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Regions
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.regions.map((region) => (
              <RegionRiskCard key={region.code} summary={region} />
            ))}
          </div>
        </section>

        {summary.catchments.map((catchment) => {
          const style = RISK_LEVEL_STYLES[catchment.level];
          const label = RISK_LEVEL_LABELS[catchment.level];
          return (
            <section key={catchment.code} className="mb-10 w-full">
              <div className="mb-3 flex items-center gap-2">
                <MapPinned size={15} className="text-earth" aria-hidden="true" />
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                  {catchment.displayName}
                </h2>
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${style.badge}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${style.dot}`}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              </div>
              <p className="text-[14px] text-ink-secondary">
                {catchment.waterwayName} catchment · {catchment.upstream.length}{" "}
                upstream watch points
              </p>
              {catchment.reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {catchment.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="text-[13px] text-ink-muted"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent alerts
          </h2>
          <RecentAlerts alerts={recentAlerts} />
        </section>

        <Link
          href="/"
          className="text-[13px] font-medium text-earth underline-offset-4 hover:underline"
        >
          Subscribe for SMS alerts
        </Link>

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
