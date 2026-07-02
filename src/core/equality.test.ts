import { describe, expect, it } from "vitest";
import { sameWebhookUrl } from "./equality.js";

describe("sameWebhookUrl", () => {
  it("matches identical URLs", () => {
    expect(sameWebhookUrl("https://app.example.com/hooks", "https://app.example.com/hooks")).toBe(
      true,
    );
  });

  it("ignores trailing slashes", () => {
    expect(sameWebhookUrl("https://app.example.com/hooks/", "https://app.example.com/hooks")).toBe(
      true,
    );
    expect(sameWebhookUrl("https://app.example.com/hooks", "https://app.example.com/hooks/")).toBe(
      true,
    );
  });

  it("collapses multiple trailing slashes", () => {
    expect(
      sameWebhookUrl("https://app.example.com/hooks///", "https://app.example.com/hooks"),
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(sameWebhookUrl("HTTPS://APP.EXAMPLE.COM/hooks", "https://app.example.com/hooks")).toBe(
      true,
    );
  });

  it("rejects different paths", () => {
    expect(sameWebhookUrl("https://app.example.com/hooks", "https://app.example.com/other")).toBe(
      false,
    );
  });

  it("rejects different hosts", () => {
    expect(sameWebhookUrl("https://app.example.com/hooks", "https://other.example.com/hooks")).toBe(
      false,
    );
  });
});
