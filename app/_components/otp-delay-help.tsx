"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Hash } from "lucide-react";

const DELAY_HELP_MS = 5_000;
const DOCS_USSD_CODE = "*928*01#";
const USSD_PLACEHOLDER_PREFIX = "replace-with-";

function getConfiguredUssdCode(): string | undefined {
  const code = process.env.NEXT_PUBLIC_ARKESEL_USSD_CODE?.trim();

  if (!code || code.startsWith(USSD_PLACEHOLDER_PREFIX)) {
    return undefined;
  }

  return code;
}

function createTelHref(ussdCode: string): string {
  return `tel:${encodeURIComponent(ussdCode)}`;
}

interface OtpDelayHelpProps {
  phone?: string;
  ussdCode?: string;
  className?: string;
}

export default function OtpDelayHelp({
  phone,
  ussdCode,
  className = "",
}: OtpDelayHelpProps) {
  const [expanded, setExpanded] = useState(false);
  const fallbackUssdCode = useMemo(() => getConfiguredUssdCode(), []);
  const providedUssdCode = ussdCode?.trim();
  const displayUssdCode =
    providedUssdCode || fallbackUssdCode || DOCS_USSD_CODE;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setExpanded(true);
    }, DELAY_HELP_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!expanded) {
    return null;
  }

  return (
    <div
      className={`animate-select-pop w-full rounded-xl border border-[#ead7b8] bg-[#fff8ec] p-3 text-left shadow-[0_12px_28px_rgba(20,17,16,0.06)] ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-earth/10 text-earth">
          <Clock size={14} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">
            Code taking longer than expected?
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
            Dial{" "}
            <a
              href={createTelHref(displayUssdCode)}
              className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-0.5 font-mono text-[13px] font-bold text-earth ring-1 ring-border transition-colors hover:bg-earth hover:text-white"
            >
              <Hash size={10} aria-hidden="true" />
              {displayUssdCode}
            </a>{" "}
            from {phone ? "this phone" : "the same phone"}, copy the OTP shown,
            then paste it above to verify.
          </p>
        </div>
      </div>
    </div>
  );
}
