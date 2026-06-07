export const OTP_CODE_LENGTH = 6;
export const OTP_CODE_PATTERN = /^\d{6}$/;

export function sanitizeOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

export function getOtpCodeValidationError(value: string): string | undefined {
  if (!value.trim()) {
    return "Enter the verification code";
  }

  if (!OTP_CODE_PATTERN.test(value)) {
    return "Enter the 6-digit code";
  }

  return undefined;
}
