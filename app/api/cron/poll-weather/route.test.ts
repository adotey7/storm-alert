import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchPointForecast, prisma, sendSms } = vi.hoisted(() => ({
  fetchPointForecast: vi.fn(),
  prisma: {
    subscriber: {
      findMany: vi.fn(),
    },
    alertLog: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  sendSms: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => prisma,
}));

vi.mock("@/lib/weather-client", () => ({
  fetchPointForecast,
}));

vi.mock("@/lib/sms-dispatcher", () => ({
  sendSms,
}));

function cronRequest() {
  return new Request("https://storm-alert.example/api/cron/poll-weather", {
    headers: {
      "x-cron-secret": "test-secret",
    },
  });
}

function createForecast(precipitation: number[] = [0, 1, 2, 1, 0, 0]) {
  return {
    latitude: 5,
    longitude: 0,
    hourly: {
      time: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"],
      precipitation,
      precipitation_probability: [10, 20, 30, 20, 10, 0],
      wind_speed_10m: [10, 12, 14, 12, 10, 8],
      weather_code: [1, 2, 3, 2, 1, 0],
    },
  };
}

function isAburiPoint(point: { lat: number; lon: number }) {
  return Math.abs(point.lat - 5.848) < 0.0001 &&
    Math.abs(point.lon - -0.1745) < 0.0001;
}

describe("poll weather cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://storm-alert.example");
    prisma.alertLog.findFirst.mockResolvedValue(null);
    prisma.alertLog.create.mockResolvedValue({ id: "alert_123" });
    prisma.subscriber.findMany.mockResolvedValue([
      {
        phone: "+233244111111",
        regionCode: "accra",
        forecastZoneCode: "gh-grid-p5p65-m0p20",
        forecastLat: 5.65,
        forecastLon: -0.2,
      },
    ]);
    fetchPointForecast.mockImplementation((point: { lat: number; lon: number }) =>
      Promise.resolve(isAburiPoint(point) ? createForecast([0, 24, 0, 0, 0, 0]) : createForecast()),
    );
    sendSms.mockResolvedValue({ sent: true, skipped: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("evaluates catchment watch points and sends one catchment alert", async () => {
    const { GET } = await import("./route");
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.catchments_checked).toBe(1);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target_code: "odaw-christian-village",
          target_kind: "catchment",
          triggered: true,
          recipients: 1,
        }),
      ]),
    );
    expect(fetchPointForecast).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 5.848, lon: -0.1745 }),
    );
    expect(fetchPointForecast).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 5.71056, lon: -0.23306 }),
    );
    expect(fetchPointForecast).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 5.6833, lon: -0.1667 }),
    );
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ["+233244111111"],
        message: expect.stringContaining(
          "Flood risk detected for Odaw/Dome Bridge drainage area.",
        ),
      }),
    );
    expect(prisma.alertLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        regionCode: "odaw-christian-village",
        recipientsCount: 1,
      }),
    });
  });
});
