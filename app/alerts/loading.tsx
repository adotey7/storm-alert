import { MapPinned } from "lucide-react";

export default function Loading() {
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

        {/* Impact bar skeleton */}
        <div className="mb-8 w-full animate-pulse rounded-lg border border-border bg-ink/[0.02] px-4 py-5">
          <div className="flex items-center justify-around">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="size-5 rounded bg-ink/10" />
                <div className="h-5 w-12 rounded bg-ink/10" />
                <div className="h-3 w-16 rounded bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Region cards skeleton */}
        <section className="mb-10 w-full">
          <div className="mb-3 flex items-center gap-2">
            <MapPinned
              size={15}
              className="text-ink-muted"
              aria-hidden="true"
            />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Regions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-border bg-ink/[0.02]"
              />
            ))}
          </div>
        </section>

        {/* Coverage map skeleton */}
        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Coverage map
          </h2>
          <div className="h-72 w-full animate-pulse rounded-xl border border-border bg-ink/[0.02]" />
        </section>

        {/* Recent alerts skeleton */}
        <section className="mb-10 w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent alerts
          </h2>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg border border-border bg-ink/[0.02]"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
