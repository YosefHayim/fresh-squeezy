import { describe, expect, it } from "vitest";
import { renderReport, renderResult } from "../../src/cli/render.js";
import type { ValidationResult, DoctorReport } from "../../src/core/types.js";

const stripAnsi = (value: string): string => value.replace(/\[[0-9;]*m/g, "");

describe("renderResult", () => {
  it("marks a clean result as PASS", () => {
    const result: ValidationResult = {
      name: "connection",
      ok: true,
      mode: "test",
      issues: [],
    };
    expect(stripAnsi(renderResult(result))).toContain("PASS [test] connection");
  });

  it("marks a failing result as FAIL and lists issues with codes", () => {
    const result: ValidationResult = {
      name: "store",
      ok: false,
      mode: "live",
      issues: [
        {
          code: "STORE_NOT_FOUND",
          severity: "error",
          message: "nope",
          suggestedFix: "double-check the id",
        },
      ],
    };
    const text = stripAnsi(renderResult(result));
    expect(text).toContain("FAIL [live] store");
    expect(text).toContain("[STORE_NOT_FOUND]");
    expect(text).toContain("fix: double-check the id");
  });
});

describe("renderReport", () => {
  it("includes the overall header and all results", () => {
    const report: DoctorReport = {
      ok: false,
      mode: "test",
      results: [
        { name: "connection", ok: true, mode: "test", issues: [] },
        {
          name: "store",
          ok: false,
          mode: "test",
          issues: [{ code: "STORE_NOT_FOUND", severity: "error", message: "nope" }],
        },
      ],
    };
    const text = stripAnsi(renderReport(report));
    expect(text).toContain("fresh-squeezy doctor: FAILED");
    expect(text).toContain("PASS [test] connection");
    expect(text).toContain("FAIL [test] store");
  });
});
