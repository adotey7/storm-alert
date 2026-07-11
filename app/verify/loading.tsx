export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-10 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Verify code
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-secondary">
            Enter the SMS code to activate StormAlert GH.
          </p>
        </div>

        <div className="w-full animate-pulse space-y-4">
          <div className="h-12 rounded-lg border border-border bg-ink/[0.02]" />
          <div className="h-12 rounded-lg border border-border bg-ink/[0.02]" />
          <div className="h-12 rounded-lg bg-ink/10" />
        </div>
      </div>
    </main>
  );
}
