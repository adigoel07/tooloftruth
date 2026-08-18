import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeBehaviorInsights, detectRetryLoops, formatBehaviorInsights } from "../behavior-insights.js";
import { persistSatisfaction, type SatisfactionRecord } from "../satisfaction.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tot-insights-"));
  for (const sub of ["receipts", "conversations", "ledger", "satisfaction"]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function rec(id: string, tool: string, server: string, sessionId: string, ts: string, opts: any = {}) {
  return {
    id, timestamp: ts, tool, server, sessionId, userPrompt: "",
    params: {}, result: {}, durationMs: opts.durationMs ?? 100,
    isError: opts.isError ?? false,
    tokens: { input: opts.input ?? 100, output: 50 },
    costUsd: opts.cost ?? 0,
    verification: {
      schemaValid: true, responsePlausible: true,
      trustScore: opts.trust ?? 95,
      verdict: opts.isError ? "SUSPICIOUS" : "VERIFIED",
      fabricationConfidence: 0, checksPerformed: [],
    },
  };
}

function writeReceipt(date: string, r: any) {
  appendFileSync(join(dir, "receipts", `${date}.jsonl`), JSON.stringify(r) + "\n");
}

function writeLedger(sessions: Record<string, any>) {
  writeFileSync(join(dir, "ledger", "2026-08-18.json"), JSON.stringify(sessions, null, 2));
}

describe("retry loops (F2)", () => {
  it("detects consecutive same-tool runs with errors", () => {
    const today = "2026-08-18";
    const calls = Array.from({ length: 5 }, (_, i) =>
      rec(`c${i}`, "bash", "deepseek", "s1", `${today}T10:0${i}:00Z`, { isError: true })
    );
    const loops = detectRetryLoops(calls);
    expect(loops.length).toBe(1);
    expect(loops[0].tool).toBe("bash");
    expect(loops[0].count).toBe(5);
  });

  it("does not report error-free consecutive runs", () => {
    const today = "2026-08-18";
    const calls = Array.from({ length: 6 }, (_, i) =>
      rec(`c${i}`, "bash", "deepseek", "s1", `${today}T10:0${i}:00Z`)
    );
    const loops = detectRetryLoops(calls);
    expect(loops.length).toBe(0);
  });
});

describe("satisfaction persistence + correlation (F1)", () => {
  it("persists and correlates satisfaction by tool", () => {
    const sat: SatisfactionRecord = {
      toolCallId: "call_1", timestamp: "2026-08-18T10:00:00Z",
      sessionId: "s1", tool: "bash", server: "deepseek",
      satisfied: false, confidence: 0.8, signals: ["Negative: wrong"],
    };
    persistSatisfaction(sat, dir);
    const sat2: SatisfactionRecord = {
      toolCallId: "call_2", timestamp: "2026-08-18T10:01:00Z",
      sessionId: "s1", tool: "read", server: "deepseek",
      satisfied: true, confidence: 0.9, signals: ["Positive: thanks"],
    };
    persistSatisfaction(sat2, dir);

    const insights = computeBehaviorInsights(dir);
    expect(insights.satisfactionByTool.length).toBe(2);
    const bash = insights.satisfactionByTool.find((t) => t.tool === "bash");
    expect(bash?.dissatisfied).toBe(1);
    expect(bash?.rate).toBe(0);
    const read = insights.satisfactionByTool.find((t) => t.tool === "read");
    expect(read?.rate).toBe(1);
  });
});

describe("hourly profile (F3)", () => {
  it("buckets receipts by hour", () => {
    const today = "2026-08-18";
    // Use local-time ISO strings so getHours() is deterministic in any tz.
    writeReceipt(today, rec("1", "bash", "deepseek", "s1", `${today}T09:00:00`));
    writeReceipt(today, rec("2", "bash", "deepseek", "s1", `${today}T09:30:00`, { isError: true }));
    writeReceipt(today, rec("3", "bash", "deepseek", "s1", `${today}T23:00:00`));
    const insights = computeBehaviorInsights(dir);
    const h9 = insights.hourly.find((h) => h.hour === 9);
    expect(h9?.calls).toBe(2);
    expect(h9?.errorRate).toBeCloseTo(0.5);
    const h23 = insights.hourly.find((h) => h.hour === 23);
    expect(h23?.calls).toBe(1);
  });
});

describe("prompt creep (F4)", () => {
  it("detects input-token growth across a session", () => {
    const today = "2026-08-18";
    writeLedger({
      s1: { sessionId: "s1", model: "deepseek", messages: 20, toolCalls: 10, errors: 0, totalTokens: 100000, costUsd: 0, firstSeen: `${today}T09:00:00Z`, lastSeen: `${today}T10:00:00Z` },
    });
    // 20 messages: first 10 small input, last 10 growing
    const convs = [];
    for (let i = 0; i < 20; i++) {
      const input = i < 10 ? 500 : 500 + (i - 9) * 1000;
      convs.push({ sessionId: "s1", role: "assistant", timestamp: `${today}T09:${String(i).padStart(2, "0")}:00Z`, tokens: { input, output: 50 } });
    }
    writeFileSync(join(dir, "conversations", `${today}.jsonl`), convs.map((c) => JSON.stringify(c)).join("\n"));

    const insights = computeBehaviorInsights(dir);
    const s = insights.sessions[0];
    expect(s.promptCreep).toBeGreaterThan(0.3);
  });
});

describe("cross-model (F5)", () => {
  it("compares same tool across models with trust spread", () => {
    const today = "2026-08-18";
    // bash used by deepseek (high trust) and claude (low trust)
    writeReceipt(today, rec("1", "bash", "deepseek", "s1", `${today}T10:00:00Z`, { trust: 95 }));
    writeReceipt(today, rec("2", "bash", "deepseek", "s1", `${today}T10:01:00Z`, { trust: 90 }));
    writeReceipt(today, rec("3", "bash", "claude", "s2", `${today}T10:02:00Z`, { trust: 50 }));
    writeReceipt(today, rec("4", "bash", "claude", "s2", `${today}T10:03:00Z`, { trust: 55 }));
    writeReceipt(today, rec("5", "read", "deepseek", "s1", `${today}T10:04:00Z`, { trust: 90 }));

    const insights = computeBehaviorInsights(dir);
    const cmp = insights.crossModel.find((c) => c.tool === "bash");
    expect(cmp).toBeDefined();
    expect(cmp!.models.length).toBe(2);
    expect(cmp!.spread).toBeGreaterThan(30);
    const deepseek = cmp!.models.find((m) => m.model === "deepseek");
    const claude = cmp!.models.find((m) => m.model === "claude");
    expect(deepseek!.avgTrustScore).toBeGreaterThan(claude!.avgTrustScore);
  });
});

describe("formatting", () => {
  it("renders without error", () => {
    const insights = computeBehaviorInsights(dir);
    const text = formatBehaviorInsights(insights);
    expect(text).toContain("Model Behavior Insights");
  });
});
