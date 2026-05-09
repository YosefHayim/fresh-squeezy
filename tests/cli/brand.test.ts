import { describe, expect, it } from "vitest";
import { renderStep } from "../../src/cli/brand.js";

const stripAnsi = (value: string): string => value.replace(/\[[0-9;]*m/g, "");

describe("renderStep", () => {
  it("keeps the first step tight and separates later steps with a blank line", () => {
    expect(stripAnsi(renderStep(1, 5, "Credentials"))).toBe("● 1/5 Credentials\n");
    expect(stripAnsi(renderStep(2, 5, "Account probe"))).toBe("\n● 2/5 Account probe\n");
  });
});
