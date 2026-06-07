export type ApiMessageResponse = {
  message?: string;
  error?: string;
  dev_otp?: string;
  ussd_code?: string;
};

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export async function readApiMessageResponse(
  response: Response,
): Promise<ApiMessageResponse> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  try {
    const data: unknown = await response.json();

    if (!data || typeof data !== "object") {
      return {};
    }

    const record = data as Record<string, unknown>;

    return {
      message: readString(record, "message"),
      error: readString(record, "error"),
      dev_otp: readString(record, "dev_otp"),
      ussd_code: readString(record, "ussd_code"),
    };
  } catch {
    return {};
  }
}
