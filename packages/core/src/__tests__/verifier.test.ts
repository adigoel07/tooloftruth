import { describe, it, expect } from "vitest";
import { Verifier } from "../verifier.js";
import type { ToolCallRecord, SkillManifest } from "../types.js";

function makeRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    id: "call_test_001",
    timestamp: new Date().toISOString(),
    tool: "echo",
    server: "echo",
    sessionId: "sess_test",
    userPrompt: "test prompt",
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

describe("Verifier", () => {
  const verifier = new Verifier();

  describe("checkPreflight", () => {
    it("detects installed tools", async () => {
      const result = await verifier.checkPreflight("node");
      expect(result.installed).toBe(true);
      expect(result.version).toBeTruthy();
    });

    it("detects missing tools", async () => {
      const result = await verifier.checkPreflight("nonexistent-tool-xyz");
      expect(result.installed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("verifyToolCall", () => {
    it("returns VERIFIED for a normal call", async () => {
      const record = makeRecord();
      const result = await verifier.verifyToolCall(record);
      expect(result.verdict).toBe("VERIFIED");
      expect(result.trustScore).toBeGreaterThan(50);
    });

    it("flags zero-duration calls as suspicious", async () => {
      const record = makeRecord({ durationMs: 0 });
      const result = await verifier.verifyToolCall(record);
      expect(result.trustScore).toBeLessThan(100);
    });

    it("flags placeholder patterns", async () => {
      const record = makeRecord({
        result: { text: "This is example.com placeholder data" },
      });
      const result = await verifier.verifyToolCall(record);
      expect(result.fabricationConfidence).toBeGreaterThan(0);
    });
  });

  describe("calculateTrustScore", () => {
    it("gives high score for all-pass", () => {
      const signals = [
        { name: "test", weight: 0.1, triggered: false, detail: "" },
      ];
      const score = verifier.calculateTrustScore(true, true, signals, true);
      expect(score.overall).toBeGreaterThanOrEqual(70);
      expect(score.verdict).toBe("VERIFIED");
    });

    it("caps score when fabrication confidence is high", () => {
      const signals = [
        { name: "test", weight: 0.8, triggered: true, detail: "" },
      ];
      const score = verifier.calculateTrustScore(true, true, signals, true);
      expect(score.overall).toBeLessThanOrEqual(15);
    });
  });

  describe("Skill Adherence", () => {
    it("passes when no manifest", async () => {
      const record = makeRecord();
      const result = await verifier.verifyToolCall(record);
      expect(result.checksPerformed).not.toContain("skill_adherence");
    });

    it("checks manifest when provided", async () => {
      const record = makeRecord({ server: "echo" });
      const manifest: SkillManifest = {
        skill: "test",
        version: "1.0.0",
        requires: {
          echo: { tool: "echo", mustBeCalled: true },
        },
      };
      const result = await verifier.verifyToolCall(record, manifest);
      expect(result.checksPerformed).toContain("skill_adherence");
    });
  });
});
