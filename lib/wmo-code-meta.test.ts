import { describe, expect, it } from "vitest";
import { getWmoCodeMeta } from "./wmo-code-meta";

describe("getWmoCodeMeta", () => {
  it("maps clear-sky code 0 to a Sunny label", () => {
    const meta = getWmoCodeMeta(0);
    expect(meta.code).toBe(0);
    expect(meta.label).toBe("Clear sky");
  });

  it("maps thunderstorm codes 95-99 to a thunderstorm label", () => {
    expect(getWmoCodeMeta(95).label).toBe("Thunderstorm");
    expect(getWmoCodeMeta(99).label).toBe("Thunderstorm + heavy hail");
  });

  it("maps rain codes 61-65 to a Rain label", () => {
    expect(getWmoCodeMeta(61).label).toBe("Rain");
    expect(getWmoCodeMeta(65).label).toBe("Heavy rain");
  });

  it("falls back to an Unknown label and Cloud icon for unmapped codes", () => {
    const meta = getWmoCodeMeta(1234);
    expect(meta.label).toBe("Unknown");
    expect(meta.code).toBe(1234);
  });

  it("always returns an icon component", () => {
    expect(typeof getWmoCodeMeta(2).icon).toBe("object");
  });
});
