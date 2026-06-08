"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PhoneOff,
} from "lucide-react";
import { readApiMessageResponse } from "@/lib/api-response";
import {
  formatGhanaPhone,
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";

type Status = "idle" | "loading" | "success" | "error";

const PHONE_ERROR_ID = "unsubscribe-phone-error";
const STATUS_MESSAGE_ID = "unsubscribe-status";

export default function UnsubscribeForm() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");

  function clearStatus() {
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPhoneError = getGhanaPhoneValidationError(phone);

    if (nextPhoneError) {
      setPhoneError(nextPhoneError);
      setStatus("idle");
      setMessage("");
      return;
    }

    setPhoneError("");
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeGhanaPhone(phone),
        }),
      });
      const data = await readApiMessageResponse(response);

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not unsubscribe this number.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Unsubscribed successfully.");
    } catch {
      setStatus("error");
      setMessage("Could not reach the unsubscribe service. Try again.");
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
            <label htmlFor="unsubscribe-phone" className="sr-only">
              Phone number
            </label>
            <div className="relative">
              <PhoneOff
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="unsubscribe-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="024 412 3456"
                value={phone}
                onChange={(event) => {
                  setPhone(formatGhanaPhone(event.target.value));
                  clearStatus();

                  if (phoneError) {
                    setPhoneError("");
                  }
                }}
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? PHONE_ERROR_ID : undefined}
                className={`w-full rounded-xl border bg-canvas py-3 pl-10 pr-3 font-mono text-[15px] text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  phoneError
                    ? "border-error focus:ring-error/20"
                    : "border-border focus:ring-earth/20"
                }`}
              />
            </div>
            {phoneError && (
              <p
                id={PHONE_ERROR_ID}
                className="mt-1 flex items-center gap-1 pl-1 text-[12px] text-error"
              >
                <AlertCircle size={11} aria-hidden="true" />
                {phoneError}
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
                Unsubscribing...
              </>
            ) : (
              "Unsubscribe"
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
