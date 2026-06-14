import { MapPinned } from "lucide-react";
import UpdateAlertAreaForm from "../_components/update-alert-area-form";

export default function UpdateAlertAreaPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-10 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Update alert area
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-secondary">
            Move an existing subscription to a new region or local forecast area.
          </p>
        </div>

        <UpdateAlertAreaForm />

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <MapPinned size={12} strokeWidth={1.5} aria-hidden="true" />
          Verified phone update
        </p>
      </div>
    </main>
  );
}
