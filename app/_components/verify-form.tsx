"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Phone,
} from "lucide-react";
import { readApiMessageResponse } from "@/lib/api-response";
import {
  formatGhanaPhone,
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import {
  getOtpCodeValidationError,
  sanitizeOtpInput,
} from "@/lib/otp-code";
import OtpDelayHelp from "./otp-delay-help";

type Status = "idle" | "loading" | "success" | "error";

type FieldErrors = {
  phone?: string;
  code?: string;
};

const PHONE_ERROR_ID = "verify-phone-error";
const CODE_ERROR_ID = "verify-code-error";
const STATUS_MESSAGE_ID = "verify-status";

interface VerifyFormProps {
  initialPhone?: string;
  initialUssdCode?: string;
}

export default function VerifyForm({
  initialPhone = "",
  initialUssdCode = "",
}: VerifyFormProps) {
  const [phone, setPhone] = useState(formatGhanaPhone(initialPhone));
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearStatus() {
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const phoneError = getGhanaPhoneValidationError(phone);
    const codeError = getOtpCodeValidationError(code);

    if (phoneError) {
      nextErrors.phone = phoneError;
    }

    if (codeError) {
      nextErrors.code = codeError;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setStatus("idle");
      setMessage("");
      return;
    }

    setFieldErrors({});
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeGhanaPhone(phone),
          code,
        }),
      });
      const data = await readApiMessageResponse(response);

      if (!response.ok) {
        setStatus("error");
        setMessage(
          data.error ?? "Could not verify this code. Check it and try again.",
        );
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Subscription verified.");
    } catch {
      setStatus("error");
      setMessage("Could not reach the verification service. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className="animate-fade-up w-full max-w-md rounded-xl border border-border bg-canvas px-8 py-10 text-center"
        role="status"
      >
        <CheckCircle2
          size={36}
          className="mx-auto mb-5 text-success"
          aria-hidden="true"
        />
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          {message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-earth px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-hover focus:outline-none focus:ring-2 focus:ring-earth/30 focus:ring-offset-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up w-full max-w-md">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="verify-phone" className="sr-only">
              Phone number
            </label>
            <div className="relative">
              <Phone
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="verify-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="024 412 3456"
                value={phone}
                onChange={(event) => {
                  setPhone(formatGhanaPhone(event.target.value));
                  clearStatus();

                  if (fieldErrors.phone) {
                    setFieldErrors((previous) => ({
                      ...previous,
                      phone: undefined,
                    }));
                  }
                }}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={
                  fieldErrors.phone ? PHONE_ERROR_ID : undefined
                }
                className={`w-full rounded-xl border bg-canvas py-3 pl-10 pr-3 font-mono text-[15px] text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  fieldErrors.phone
                    ? "border-error focus:ring-error/20"
                    : "border-border focus:ring-earth/20"
                }`}
              />
            </div>
            {fieldErrors.phone && (
              <p
                id={PHONE_ERROR_ID}
                className="mt-1 flex items-center gap-1 pl-1 text-[12px] text-error"
              >
                <AlertCircle size={11} aria-hidden="true" />
                {fieldErrors.phone}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="verify-code" className="sr-only">
              Verification code
            </label>
            <div className="relative">
              <LockKeyhole
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="verify-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(sanitizeOtpInput(event.target.value));
                  clearStatus();

                  if (fieldErrors.code) {
                    setFieldErrors((previous) => ({
                      ...previous,
                      code: undefined,
                    }));
                  }
                }}
                aria-invalid={!!fieldErrors.code}
                aria-describedby={fieldErrors.code ? CODE_ERROR_ID : undefined}
                className={`w-full rounded-xl border bg-canvas py-3 pl-10 pr-3 font-mono text-[15px] text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  fieldErrors.code
                    ? "border-error focus:ring-error/20"
                    : "border-border focus:ring-earth/20"
                }`}
              />
            </div>
            {fieldErrors.code && (
              <p
                id={CODE_ERROR_ID}
                className="mt-1 flex items-center gap-1 pl-1 text-[12px] text-error"
              >
                <AlertCircle size={11} aria-hidden="true" />
                {fieldErrors.code}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-earth px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-earth-hover focus:outline-none focus:ring-2 focus:ring-earth/30 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                Verifying...
              </>
            ) : (
              "Verify subscription"
            )}
          </button>
        </div>

        {status === "error" && message && (
          <p
            id={STATUS_MESSAGE_ID}
            className="mt-3 text-center text-[13px] text-error"
            role="alert"
          >
            {message}
          </p>
        )}

        <OtpDelayHelp
          phone={normalizeGhanaPhone(phone) || phone}
          ussdCode={initialUssdCode}
          className="mt-5 text-center"
        />

        <div className="mt-5 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-earth"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Back to subscribe
          </Link>
        </div>
      </form>
    </div>
  );
}
