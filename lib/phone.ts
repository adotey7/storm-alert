function joinPhoneParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatGhanaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("233")) {
    const local = digits.slice(3, 12);
    return joinPhoneParts([
      "+233",
      local.slice(0, 2),
      local.slice(2, 5),
      local.slice(5, 9),
    ]);
  }

  if (digits.startsWith("0")) {
    const local = digits.slice(0, 10);
    return joinPhoneParts([
      local.slice(0, 3),
      local.slice(3, 6),
      local.slice(6, 10),
    ]);
  }

  const local = digits.slice(0, 9);
  return joinPhoneParts([
    "+233",
    local.slice(0, 2),
    local.slice(2, 5),
    local.slice(5, 9),
  ]);
}

export function normalizeGhanaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("233")) {
    return digits.length === 12 ? `+${digits}` : "";
  }

  if (digits.startsWith("0")) {
    return digits.length === 10 ? `+233${digits.slice(1)}` : "";
  }

  return digits.length === 9 ? `+233${digits}` : "";
}

export function getGhanaPhoneValidationError(
  value: string,
): string | undefined {
  if (!value.replace(/\D/g, "")) {
    return "Enter a phone number";
  }

  if (!normalizeGhanaPhone(value)) {
    return "Enter a valid Ghana number";
  }

  return undefined;
}
