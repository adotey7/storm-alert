import { describe, expect, it } from "vitest";
import {
  formatGhanaPhone,
  getGhanaPhoneValidationError,
  normalizeGhanaPhone,
} from "./phone";

describe("Ghana phone utilities", () => {
  it("formats local Ghana phone numbers for display", () => {
    expect(formatGhanaPhone("0244123456")).toBe("024 412 3456");
  });

  it("formats international Ghana phone numbers for display", () => {
    expect(formatGhanaPhone("+233244123456")).toBe("+233 24 412 3456");
  });

  it("normalizes accepted Ghana phone number forms to E.164", () => {
    expect(normalizeGhanaPhone("024 412 3456")).toBe("+233244123456");
    expect(normalizeGhanaPhone("+233 24 412 3456")).toBe("+233244123456");
    expect(normalizeGhanaPhone("244123456")).toBe("+233244123456");
  });

  it("reports validation errors for missing or invalid numbers", () => {
    expect(getGhanaPhoneValidationError("")).toBe("Enter a phone number");
    expect(getGhanaPhoneValidationError("123")).toBe(
      "Enter a valid Ghana number",
    );
    expect(getGhanaPhoneValidationError("024 412 3456")).toBeUndefined();
  });
});
