import { CloudLightning } from "lucide-react";
import SubscribeForm from "./_components/subscribe-form";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-10 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            StormAlert GH
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-secondary">
            Free SMS alerts for storms and floods in Ghana.
          </p>
        </div>

        <SubscribeForm />

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
