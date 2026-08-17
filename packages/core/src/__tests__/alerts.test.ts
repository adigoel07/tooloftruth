import { describe, it, expect } from "vitest";
import { checkCostAlerts, shouldBlockCall, formatAlerts } from "../alerts.js";
import type { ToolCallRecord, BudgetConfig } from "../types.js";

function makeRecord(tool: string, costUsd: number, timestamp?: string): ToolCallRecord {
  return {
    id: `call_${Date.now()}_${Math.random()}`,
    timestamp: timestamp || new Date().toISOString(),
    tool,
    server: tool,
    sessionId: "sess_test",
    userPrompt: "test",
    params: {},
    result: {},
    durationMs: 100,
    isError: false,
    tokens: { input: 0, output: 0 },
    costUsd,
    verification: {
      schemaValid: true,
      responsePlausible: true,
      trustScore: 95,
      verdict: "VERIFIED",
      fabricationConfidence: 0,
      checksPerformed: [],
    },
  };
}

describe("Cost Alerts", () => {
  it("detects daily spike", () => {
    const today = new Date().toISOString().slice(0, 10);
    const calls = [makeRecord("firecrawl", 5.0, `${today}T10:00:00Z`)];
    const alerts = checkCostAlerts(calls, {}, 1.0);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe("daily_spike");
  });

  it("detects single expensive call", () => {
    const today = new Date().toISOString().slice(0, 10);
    const calls = [makeRecord("firecrawl", 0.50, `${today}T10:00:00Z`)];
    const alerts = checkCostAlerts(calls, { perCallLimitUsd: 0.10 });
    expect(alerts.some((a) => a.type === "single_call_expensive")).toBe(true);
  });

  it("detects budget exceeded", () => {
    const today = new Date().toISOString().slice(0, 10);
    const calls = [makeRecord("firecrawl", 15.0, `${today}T10:00:00Z`)];
    const alerts = checkCostAlerts(calls, { dailyLimitUsd: 10.0 });
    expect(alerts.some((a) => a.type === "budget_exceeded")).toBe(true);
  });

  it("detects unusual pattern", () => {
    const today = new Date().toISOString().slice(0, 10);
    const calls = Array.from({ length: 25 }, (_, i) =>
      makeRecord("firecrawl", 0.01, `${today}T${String(10 + i % 14).padStart(2, "0")}:00:00Z`)
    );
    const alerts = checkCostAlerts(calls, {});
    expect(alerts.some((a) => a.type === "unusual_pattern")).toBe(true);
  });

  it("returns no alerts when everything is normal", () => {
    const today = new Date().toISOString().slice(0, 10);
    const calls = [makeRecord("firecrawl", 0.01, `${today}T10:00:00Z`)];
    const alerts = checkCostAlerts(calls, { dailyLimitUsd: 100.0 }, 0.01);
    expect(alerts.length).toBe(0);
  });
});

describe("Budget Blocking", () => {
  it("blocks when per-call limit exceeded", () => {
    const result = shouldBlockCall(0.50, { perCallLimitUsd: 0.10 }, 0);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("per-call limit");
  });

  it("blocks when daily limit would be exceeded", () => {
    const result = shouldBlockCall(5.0, { dailyLimitUsd: 10.0 }, 8.0);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("daily budget");
  });

  it("allows when within limits", () => {
    const result = shouldBlockCall(0.01, { dailyLimitUsd: 10.0, perCallLimitUsd: 1.0 }, 0);
    expect(result.blocked).toBe(false);
  });
});

describe("Alert Formatting", () => {
  it("formats alerts", () => {
    const text = formatAlerts([
      { type: "daily_spike", severity: "warning", message: "Cost spike", current: 5, threshold: 1 },
    ]);
    expect(text).toContain("Cost Alerts");
    expect(text).toContain("Cost spike");
  });

  it("formats empty alerts", () => {
    const text = formatAlerts([]);
    expect(text).toContain("No cost alerts");
  });
});
