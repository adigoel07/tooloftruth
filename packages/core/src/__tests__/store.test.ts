import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ReceiptStore } from "../store.js";
import type { ToolCallRecord } from "../types.js";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), ".tooloftruth-test");

function makeRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    id: `call_${Date.now()}`,
    timestamp: new Date().toISOString(),
    tool: "echo",
    server: "echo",
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

describe("ReceiptStore", () => {
  let store: ReceiptStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    store = new ReceiptStore(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("creates receipts directory", () => {
    expect(existsSync(join(TEST_DIR, "receipts"))).toBe(true);
  });

  it("appends calls to daily JSONL files", () => {
    const record = makeRecord();
    store.appendCall(record);

    const today = record.timestamp.slice(0, 10);
    const filePath = join(TEST_DIR, "receipts", `${today}.jsonl`);
    expect(existsSync(filePath)).toBe(true);
  });

  it("updates index after appending", () => {
    const record = makeRecord({ tool: "firecrawl", costUsd: 0.05 });
    store.appendCall(record);

    const index = store.getIndex();
    expect(index.totalCalls).toBe(1);
    expect(index.totalCostUsd).toBeCloseTo(0.05);
    expect(index.byTool["firecrawl"]).toBeDefined();
    expect(index.byTool["firecrawl"].totalCalls).toBe(1);
  });

  it("queries by tool", () => {
    store.appendCall(makeRecord({ tool: "firecrawl" }));
    store.appendCall(makeRecord({ tool: "github" }));
    store.appendCall(makeRecord({ tool: "firecrawl" }));

    const records = store.queryTool("firecrawl");
    expect(records.length).toBe(2);
  });

  it("gets stats", () => {
    store.appendCall(makeRecord({ costUsd: 0.10 }));
    store.appendCall(makeRecord({ costUsd: 0.20 }));

    const stats = store.getStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.totalCostUsd).toBeCloseTo(0.30);
  });

  it("handles multiple sessions", () => {
    store.appendCall(makeRecord({ sessionId: "sess_1" }));
    store.appendCall(makeRecord({ sessionId: "sess_2" }));
    store.appendCall(makeRecord({ sessionId: "sess_1" }));

    const index = store.getIndex();
    expect(Object.keys(index.bySession).length).toBe(2);
    expect(index.bySession["sess_1"].calls).toBe(2);
    expect(index.bySession["sess_2"].calls).toBe(1);
  });
});
