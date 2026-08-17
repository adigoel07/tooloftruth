import { describe, it, expect } from "vitest";
import { calculateCost, calculateEfficiency, buildCostBreakdown, formatCostReport } from "../cost.js";
import type { ToolCallRecord } from "../types.js";

function makeRecord(tool: string, costUsd: number, tokens = { input: 1000, output: 500 }): ToolCallRecord {
  return {
    id: `call_${tool}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    tool,
    server: tool,
    sessionId: "sess_test",
    userPrompt: "test",
    params: {},
    result: {},
    durationMs: 100,
    isError: false,
    tokens,
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

describe("Cost", () => {
  it("calculates cost from tokens", () => {
    const cost = calculateCost({ input: 1000, output: 500 }, "openai");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns zero for free providers", () => {
    const cost = calculateCost({ input: 1000, output: 500 }, "github");
    expect(cost).toBe(0);
  });

  it("calculates efficiency", () => {
    const eff = calculateEfficiency(0.01, 80);
    expect(eff).toBeGreaterThan(0);
    expect(eff).toBeLessThanOrEqual(100);
  });

  it("builds cost breakdown from calls", () => {
    const calls = [
      makeRecord("firecrawl", 0.05),
      makeRecord("github", 0),
      makeRecord("firecrawl", 0.03),
    ];
    const breakdown = buildCostBreakdown(calls);
    expect(breakdown.totalCostUsd).toBeCloseTo(0.08);
    expect(breakdown.byTool["firecrawl"].calls).toBe(2);
    expect(breakdown.byTool["github"].calls).toBe(1);
  });

  it("formats cost report", () => {
    const calls = [makeRecord("firecrawl", 0.05)];
    const breakdown = buildCostBreakdown(calls);
    const report = formatCostReport(breakdown);
    expect(report).toContain("Cost Report");
    expect(report).toContain("firecrawl");
    expect(report).toContain("$0.0500");
  });
});
