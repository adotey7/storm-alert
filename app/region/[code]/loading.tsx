import { ArrowLeft } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-8 w-full text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
            <ArrowLeft size={13} aria-hidden="true" />
            All regions
          </div>
          <div className="mx-auto h-10 w-48 animate-pulse rounded-lg bg-ink/10" />
          <div className="mx-auto mt-4 h-7 w-24 animate-pulse rounded-full bg-ink/10" />
        </div>

        <section className="w-full">
          <h2 className="mb-3 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Next hours
          </h2>
          <div className="h-24 animate-pulse rounded-lg border border-border bg-ink/2" />
        </section>
      </div>
    </main>
  );
}
