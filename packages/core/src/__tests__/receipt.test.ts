import { describe, it, expect } from "vitest";
import { generateReceiptId, hashReceipt, buildReceipt, formatReceiptHuman } from "../receipt.js";
import type { ToolCallRecord } from "../types.js";

function makeRecord(): ToolCallRecord {
  return {
    id: "call_001",
    timestamp: new Date().toISOString(),
    tool: "echo",
    server: "echo",
    sessionId: "sess_001",
    userPrompt: "test",
    params: {},
    result: {},
    durationMs: 100,
    isError: false,
    tokens: { input: 0, output: 0 },
    costUsd: 0,
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

describe("Receipt", () => {
  it("generates unique receipt IDs", () => {
    const id1 = generateReceiptId();
    const id2 = generateReceiptId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^rcpt_/);
  });

  it("hashes receipts consistently", () => {
    const base = {
      version: "1.0.0" as const,
      id: "test",
      timestamp: "2026-01-01T00:00:00Z",
      tooloftruthVersion: "0.1.0",
      agent: { name: "test", version: "0.1.0", sessionId: "s" },
      target: { name: "test", type: "mcp" as const, installed: true, configured: true },
      calls: [],
      sessionSummary: {
        totalCalls: 0,
        verified: 0,
        fabricated: 0,
        suspicious: 0,
        totalCostUsd: 0,
        totalTokens: { input: 0, output: 0 },
        avgTrustScore: 0,
      },
    };
    const h1 = hashReceipt(base);
    const h2 = hashReceipt(base);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("builds a receipt from calls", () => {
    const calls = [makeRecord()];
    const receipt = buildReceipt(
      calls,
      { name: "test", version: "0.1.0", sessionId: "s" },
      { name: "test", type: "mcp", installed: true, configured: true }
    );
    expect(receipt.version).toBe("1.0.0");
    expect(receipt.calls.length).toBe(1);
    expect(receipt.sessionSummary.totalCalls).toBe(1);
    expect(receipt.receiptHash).toHaveLength(64);
  });

  it("formats receipt for human display", () => {
    const calls = [makeRecord()];
    const receipt = buildReceipt(
      calls,
      { name: "test", version: "0.1.0", sessionId: "s" },
      { name: "test", type: "mcp", installed: true, configured: true }
    );
    const text = formatReceiptHuman(receipt);
    expect(text).toContain("Tool of Truth");
    expect(text).toContain("test");
    expect(text).toContain("rcpt_");
  });
});
