import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CloudLightning } from "lucide-react";
import { getRegionDetail } from "@/lib/live-risk";
import { RISK_LEVEL_LABELS } from "@/lib/risk-level";
import { regions } from "@/lib/regions";
import HourlyForecastStrip from "@/app/_components/hourly-forecast-strip";
import { RISK_LEVEL_STYLES } from "@/app/_components/risk-level-styles";

type Props = {
  params: Promise<{ code: string }>;
};

export function generateStaticParams() {
  return regions.map((region) => ({ code: region.code }));
}

export default async function RegionDetailPage({ params }: Props) {
  const { code } = await params;
  const detail = await getRegionDetail(code);

  if (!detail) {
    notFound();
  }

  const { summary, forecast } = detail;
  const style = RISK_LEVEL_STYLES[summary.level];
  const label = RISK_LEVEL_LABELS[summary.level];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-8 w-full text-center">
          <Link
            href="/alerts"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-earth underline-offset-4 transition-colors hover:underline"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All regions
          </Link>
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {summary.name}
          </h1>
          <span
            className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${style.badge}`}
          >
            <span className={`size-2 rounded-full ${style.dot}`} aria-hidden="true" />
            {label}
          </span>
        </div>

        <section className="w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Next hours
          </h2>
          <HourlyForecastStrip forecast={forecast} />
        </section>

        {summary.reasons.length > 0 && (
          <section className="mt-8 w-full">
            <h2 className="mb-2 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Risk factors
            </h2>
            <ul className="space-y-1.5">
              {summary.reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-ink-secondary"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
