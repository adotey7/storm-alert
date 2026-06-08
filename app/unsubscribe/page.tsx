import { ShieldOff } from "lucide-react";
import UnsubscribeForm from "../_components/unsubscribe-form";

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-10 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Unsubscribe
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-secondary">
            Stop StormAlert GH SMS alerts for your number.
          </p>
        </div>

        <UnsubscribeForm />

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldOff size={12} strokeWidth={1.5} aria-hidden="true" />
          Instant opt-out
        </p>
      </div>
    </main>
  );
}
