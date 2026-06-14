"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import { readApiMessageResponse } from "@/lib/api-response";
import {
  isWithinGhanaSupportedArea,
  type SubscriberLocationInput,
} from "@/lib/location";
import {
  formatGhanaPhone,
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "@/lib/phone";
import { findNearestRegion, regions } from "@/lib/regions";
import {
  getOtpCodeValidationError,
  sanitizeOtpInput,
} from "@/lib/otp-code";
import CustomSelect from "./custom-select";
import OtpDelayHelp from "./otp-delay-help";

type Status = "idle" | "loading" | "success" | "error";
type Step = "request" | "verify" | "done";

type FieldErrors = {
  phone?: string;
  region?: string;
  code?: string;
};

const REGION_OPTIONS = regions.map((region) => ({
  value: region.code,
  label: region.name,
}));

const PHONE_ERROR_ID = "update-alert-phone-error";
const REGION_ERROR_ID = "update-alert-region-error";
const CODE_ERROR_ID = "update-alert-code-error";
const STATUS_MESSAGE_ID = "update-alert-status";

export default function UpdateAlertAreaForm() {
  const [step, setStep] = useState<Step>("request");
  const [phone, setPhone] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [location, setLocation] = useState<SubscriberLocationInput | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [ussdCode, setUssdCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [geoLoading, setGeoLoading] = useState(false);

  const selectedRegion = regions.find((region) => region.code === regionCode);

  const clearStatus = useCallback(() => {
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  }, [status]);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Location is not available in this browser.");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        if (!isWithinGhanaSupportedArea(latitude, longitude)) {
          setLocation(null);
          setStatus("error");
          setMessage(
            "StormAlert GH location alerts currently support Ghana only. Choose a Ghana region manually if you are outside Ghana.",
          );
          setGeoLoading(false);
          return;
        }

        const nearest = findNearestRegion(latitude, longitude);

        if (nearest) {
          setRegionCode(nearest.code);
          setLocation({
            latitude,
            longitude,
            accuracy_m: Math.round(position.coords.accuracy),
          });
          setFieldErrors((previous) => ({
            ...previous,
            region: undefined,
          }));
          setStatus("idle");
          setMessage("");
        }

        setGeoLoading(false);
      },
      (error) => {
        setGeoLoading(false);
        setStatus("error");
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Could not read your location.",
        );
      },
      { timeout: 8000, enableHighAccuracy: false },
    );
  }, []);

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const phoneError = getGhanaPhoneValidationError(phone);

    if (phoneError) {
      nextErrors.phone = phoneError;
    }

    if (!regionCode) {
      nextErrors.region = "Select a region";
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
    setDevOtp("");
    setUssdCode("");

    const normalizedPhone = normalizeGhanaPhone(phone);

    try {
      const response = await fetch("/api/update-alert-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          region_code: regionCode,
          ...(location ? { location } : {}),
        }),
      });
      const data = await readApiMessageResponse(response);

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not start alert area update.");
        return;
      }

      setSubmittedPhone(normalizedPhone);
      setDevOtp(data.dev_otp ?? "");
      setUssdCode(data.ussd_code ?? "");
      setCode("");
      setStep("verify");
      setStatus("success");
      setMessage(data.message ?? "Check your phone for an update code.");
    } catch {
      setStatus("error");
      setMessage("Could not reach the update service. Try again.");
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const codeError = getOtpCodeValidationError(code);

    if (codeError) {
      setFieldErrors({ code: codeError });
      setStatus("idle");
      setMessage("");
      return;
    }

    setFieldErrors({});
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/update-alert-area/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: submittedPhone,
          code,
        }),
      });
      const data = await readApiMessageResponse(response);

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not verify this code.");
        return;
      }

      setStatus("success");
      setStep("done");
      setMessage(data.message ?? "Alert area updated.");
    } catch {
      setStatus("error");
      setMessage("Could not reach the verification service. Try again.");
    }
  }

  if (step === "done") {
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

  if (step === "verify") {
    return (
      <div className="animate-fade-up w-full max-w-md">
        <form onSubmit={handleVerifySubmit} noValidate>
          <div className="mb-4 rounded-xl border border-border bg-canvas px-4 py-3 text-center text-[13px] text-ink-secondary">
            Code sent to{" "}
            <span className="font-mono font-semibold text-ink">
              {submittedPhone}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="update-alert-code" className="sr-only">
                Update code
              </label>
              <div className="relative">
                <LockKeyhole
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="update-alert-code"
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
                  aria-describedby={
                    fieldErrors.code ? CODE_ERROR_ID : undefined
                  }
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
                  <Loader2
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Updating...
                </>
              ) : (
                "Update alert area"
              )}
            </button>
          </div>

          {devOtp && (
            <p className="mt-3 rounded-lg border border-border bg-white px-3 py-2 text-center font-mono text-sm text-ink">
              Dev code: {devOtp}
            </p>
          )}

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
            phone={submittedPhone}
            ussdCode={ussdCode}
            className="mt-5 text-center"
          />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-center">
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setStatus("idle");
                setMessage("");
                setCode("");
                setFieldErrors({});
              }}
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-earth"
            >
              <ArrowLeft size={12} aria-hidden="true" />
              Change details
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-earth"
            >
              Back to subscribe
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-up w-full max-w-2xl">
      <form onSubmit={handleRequestSubmit} noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor="update-alert-phone" className="sr-only">
              Phone number
            </label>
            <div className="relative">
              <Phone
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="update-alert-phone"
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

          <div className="flex-1">
            <label htmlFor="update-alert-region" className="sr-only">
              Region
            </label>
            <CustomSelect
              id="update-alert-region"
              options={REGION_OPTIONS}
              value={regionCode}
              onChange={(value) => {
                setRegionCode(value);
                setLocation(null);
                clearStatus();

                if (fieldErrors.region) {
                  setFieldErrors((previous) => ({
                    ...previous,
                    region: undefined,
                  }));
                }
              }}
              placeholder="Select new region..."
              icon={
                <MapPin
                  size={15}
                  className="text-ink-muted"
                  aria-hidden="true"
                />
              }
              hasError={!!fieldErrors.region}
              aria-describedby={
                fieldErrors.region ? REGION_ERROR_ID : undefined
              }
            />
            {fieldErrors.region && (
              <p
                id={REGION_ERROR_ID}
                className="mt-1 flex items-center gap-1 pl-1 text-[12px] text-error"
              >
                <AlertCircle size={11} aria-hidden="true" />
                {fieldErrors.region}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-earth px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-earth-hover focus:outline-none focus:ring-2 focus:ring-earth/30 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          >
            {status === "loading" ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                Send code
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={geoLoading}
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-earth disabled:cursor-not-allowed disabled:opacity-50"
          >
            {geoLoading ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Navigation size={12} aria-hidden="true" />
            )}
            {location && selectedRegion
              ? `Selected: ${selectedRegion.name} local alerts`
              : selectedRegion
                ? `Selected: ${selectedRegion.name}`
                : "Use my location"}
          </button>

          {status === "error" && message && (
            <p
              id={STATUS_MESSAGE_ID}
              className="mt-2 text-[13px] text-error"
              role="alert"
            >
              {message}
            </p>
          )}
        </div>

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
