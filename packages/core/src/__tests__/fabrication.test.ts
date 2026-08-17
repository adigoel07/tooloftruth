import { describe, it, expect } from "vitest";
import { detectDeepFabrication, verifyOutcome } from "../fabrication.js";
import type { ToolCallRecord } from "../types.js";

function makeRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    id: "call_test",
    timestamp: new Date().toISOString(),
    tool: "echo",
    server: "echo",
    sessionId: "sess_test",
    userPrompt: "echo hello",
    params: { message: "hello" },
    result: { content: [{ type: "text", text: "Echo: hello" }] },
    durationMs: 100,
    isError: false,
    tokens: { input: 0, output: 0 },
    costUsd: 0,
    verification: {
      schemaValid: true,
      responsePlausible: true,
      trustScore: 100,
      verdict: "VERIFIED",
      fabricationConfidence: 0,
      checksPerformed: [],
    },
    ...overrides,
  };
}

describe("Deep Fabrication Detection", () => {
  it("does NOT flag zero-duration calls when a result was returned (sub-ms local tool)", () => {
    const record = makeRecord({ durationMs: 0 });
    const signals = detectDeepFabrication(record);
    const noTrace = signals.find((s) => s.name === "no_execution_trace");
    expect(noTrace?.triggered).toBe(false);
  });

  it("flags zero-duration calls with NO result (no execution trace)", () => {
    const record = makeRecord({ durationMs: 0, result: null as unknown as Record<string, unknown> });
    const signals = detectDeepFabrication(record);
    const noTrace = signals.find((s) => s.name === "no_execution_trace");
    expect(noTrace?.triggered).toBe(true);
  });

  it("does not flag normal calls", () => {
    const record = makeRecord({ durationMs: 150 });
    const signals = detectDeepFabrication(record);
    const noTrace = signals.find((s) => s.name === "no_execution_trace");
    expect(noTrace?.triggered).toBe(false);
  });

  it("does NOT flag fast responses when a result was returned (local stdio tool)", () => {
    const record = makeRecord({ durationMs: 5 });
    const signals = detectDeepFabrication(record);
    const fast = signals.find((s) => s.name === "timing_too_fast");
    const noNetwork = signals.find((s) => s.name === "no_network_activity");
    expect(fast?.triggered).toBe(false);
    expect(noNetwork?.triggered).toBe(false);
  });

  it("flags fast responses with NO result (implausible)", () => {
    const record = makeRecord({ durationMs: 5, result: null as unknown as Record<string, unknown> });
    const signals = detectDeepFabrication(record);
    const fast = signals.find((s) => s.name === "timing_too_fast");
    const noNetwork = signals.find((s) => s.name === "no_network_activity");
    expect(fast?.triggered).toBe(true);
    expect(noNetwork?.triggered).toBe(true);
  });

  it("detects placeholder patterns", () => {
    const record = makeRecord({
      result: { text: "Visit example.com for more info" },
    });
    const signals = detectDeepFabrication(record);
    const placeholders = signals.find((s) => s.name === "placeholder_patterns");
    expect(placeholders?.triggered).toBe(true);
  });

  it("detects doc-similarity", () => {
    const record = makeRecord({
      result: { text: "This tool echoes back the input message provided" },
    });
    const signals = detectDeepFabrication(
      record,
      "This tool echoes back the input message provided by the user"
    );
    const docSim = signals.find((s) => s.name === "output_matches_docs");
    expect(docSim?.triggered).toBe(true);
  });

  it("returns correct number of signals", () => {
    const signals = detectDeepFabrication(makeRecord());
    expect(signals.length).toBe(7);
  });
});

describe("Outcome Verification", () => {
  it("passes for matching result", () => {
    const result = verifyOutcome(
      "echo hello",
      { content: [{ type: "text", text: "Echo: hello" }] },
      "Echo back the input"
    );
    expect(result.aligned).toBe(true);
  });

  it("detects empty results", () => {
    const result = verifyOutcome("get data", "", "Fetch data from API");
    expect(result.aligned).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("detects error indicators", () => {
    const result = verifyOutcome(
      "get users",
      { error: "Permission denied" },
      "Fetch users"
    );
    expect(result.aligned).toBe(false);
  });

  it("detects generic AI text", () => {
    const result = verifyOutcome(
      "get data",
      "Here are the results based on your request. I can help you with this.",
      "Fetch data"
    );
    expect(result.aligned).toBe(false);
  });

  it("passes for substantive result", () => {
    const result = verifyOutcome(
      "Get pricing for Acme",
      "Company: Acme, Price: $99.99 USD. Pricing data retrieved successfully.",
      "Fetch company pricing data"
    );
    expect(result.aligned).toBe(true);
  });
});
