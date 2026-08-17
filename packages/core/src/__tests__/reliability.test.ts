import { describe, it, expect } from "vitest";
import { calculateReliability, formatReliability } from "../reliability.js";
import type { ToolCallRecord } from "../types.js";

function makeRecord(tool: string, overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    id: `call_${Date.now()}_${Math.random()}`,
    timestamp: new Date().toISOString(),
    tool,
    server: "test",
    sessionId: "sess_test",
    userPrompt: "test",
    params: {},
    result: {},
    durationMs: 100,
    isError: false,
    tokens: { input: 0, output: 0 },
    costUsd: 0.01,
    verification: {
      schemaValid: true,
      responsePlausible: true,
      trustScore: 95,
      verdict: "VERIFIED",
      fabricationConfidence: 0,
      checksPerformed: [],
    },
    ...overrides,
  };
}

describe("Reliability", () => {
  it("calculates reliability for multiple tools", () => {
    const calls = [
      makeRecord("firecrawl", { isError: false }),
      makeRecord("firecrawl", { isError: false }),
      makeRecord("github", { isError: true }),
      makeRecord("github", { isError: false }),
    ];
    const result = calculateReliability(calls);
    expect(result.length).toBe(2);
  });

  it("gives A grade for perfect tools", () => {
    const calls = Array.from({ length: 10 }, () =>
      makeRecord("firecrawl", { isError: false, verification: { schemaValid: true, responsePlausible: true, trustScore: 98, verdict: "VERIFIED", fabricationConfidence: 0, checksPerformed: [] } })
    );
    const result = calculateReliability(calls);
    expect(result[0].grade).toBe("A");
    expect(result[0].successRate).toBe(100);
  });

  it("gives F grade for fabrication-heavy tools", () => {
    const calls = Array.from({ length: 10 }, (_, i) =>
      makeRecord("bad-tool", {
        verification: { schemaValid: true, responsePlausible: true, trustScore: 10, verdict: i < 5 ? "FABRICATION" : "VERIFIED", fabricationConfidence: i < 5 ? 0.9 : 0, checksPerformed: [] },
      })
    );
    const result = calculateReliability(calls);
    expect(result[0].grade).toBe("F");
  });

  it("formats reliability report", () => {
    const calls = [makeRecord("firecrawl")];
    const result = calculateReliability(calls);
    const text = formatReliability(result);
    expect(text).toContain("Reliability Report");
    expect(text).toContain("firecrawl");
  });

  it("returns empty message for no calls", () => {
    const text = formatReliability([]);
    expect(text).toContain("No tool data");
  });
});
