import { CloudLightning } from "lucide-react";
import VerifyForm from "../_components/verify-form";

type VerifyPageProps = {
  searchParams: Promise<{
    phone?: string | string[];
    ussd_code?: string | string[];
  }>;
};

function getInitialParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;

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

        <VerifyForm
          initialPhone={getInitialParam(params.phone)}
          initialUssdCode={getInitialParam(params.ussd_code)}
        />

        <p className="mt-16 flex items-center gap-1.5 text-xs text-ink-muted">
          <CloudLightning size={12} strokeWidth={1.5} aria-hidden="true" />
          Open Source (MIT) | Built for Ghana
        </p>
      </div>
    </main>
  );
}
