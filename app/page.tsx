import Link from "next/link";
import { CloudLightning, MapPinned, ShieldOff } from "lucide-react";
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

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[13px] text-ink-muted">
          <span>Already subscribed?</span>
          <Link
            href="/update-alert-area"
            className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
          >
            <MapPinned size={13} strokeWidth={1.8} aria-hidden="true" />
            Update alert area
          </Link>
          <Link
            href="/unsubscribe"
            className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
          >
            <ShieldOff size={13} strokeWidth={1.8} aria-hidden="true" />
            Stop SMS alerts
          </Link>
        </div>

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
