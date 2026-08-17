import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "fs";
import { join } from "path";
import type { ToolCallRecord, IndexData } from "./types.js";

const DEFAULT_RETENTION_DAYS = 90;
const INDEX_FLUSH_INTERVAL = 100;

export class ReceiptStore {
  private baseDir: string;
  private index: IndexData;
  private callsSinceFlush = 0;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.ensureDirs();
    this.index = this.loadIndex();
  }

  private ensureDirs(): void {
    const receiptsDir = join(this.baseDir, "receipts");
    if (!existsSync(receiptsDir)) {
      mkdirSync(receiptsDir, { recursive: true });
    }
  }

  private loadIndex(): IndexData {
    const indexPath = join(this.baseDir, "index.json");
    if (existsSync(indexPath)) {
      try {
        return JSON.parse(readFileSync(indexPath, "utf-8"));
      } catch {
        return this.emptyIndex();
      }
    }
    return this.emptyIndex();
  }

  private emptyIndex(): IndexData {
    return {
      lastUpdated: new Date().toISOString(),
      totalCalls: 0,
      totalCostUsd: 0,
      byTool: {},
      bySession: {},
    };
  }

  private flushIndex(): void {
    const indexPath = join(this.baseDir, "index.json");
    this.index.lastUpdated = new Date().toISOString();
    writeFileSync(indexPath, JSON.stringify(this.index, null, 2));
  }

  appendCall(record: ToolCallRecord): void {
    const date = record.timestamp.slice(0, 10);
    const filePath = join(this.baseDir, "receipts", `${date}.jsonl`);
    appendFileSync(filePath, JSON.stringify(record) + "\n");

    this.updateIndex(record);
    this.callsSinceFlush++;

    if (this.callsSinceFlush >= INDEX_FLUSH_INTERVAL) {
      this.flushIndex();
      this.callsSinceFlush = 0;
    }
  }

  private updateIndex(record: ToolCallRecord): void {
    this.index.totalCalls++;
    this.index.totalCostUsd += record.costUsd;

    const date = record.timestamp.slice(0, 10);
    const file = `${date}.jsonl`;

    if (!this.index.byTool[record.tool]) {
      this.index.byTool[record.tool] = {
        totalCalls: 0,
        totalCostUsd: 0,
        lastCalled: record.timestamp,
        avgTrustScore: 0,
        fabricationsDetected: 0,
        files: [],
      };
    }

    const toolIdx = this.index.byTool[record.tool];
    toolIdx.totalCalls++;
    toolIdx.totalCostUsd += record.costUsd;
    toolIdx.lastCalled = record.timestamp;
    toolIdx.avgTrustScore = Math.round(
      (toolIdx.avgTrustScore * (toolIdx.totalCalls - 1) +
        record.verification.trustScore) /
        toolIdx.totalCalls
    );
    if (record.verification.verdict === "FABRICATION") {
      toolIdx.fabricationsDetected++;
    }
    if (!toolIdx.files.includes(file)) {
      toolIdx.files.push(file);
    }

    if (!this.index.bySession[record.sessionId]) {
      this.index.bySession[record.sessionId] = {
        started: record.timestamp,
        calls: 0,
        costUsd: 0,
        fabrications: 0,
      };
    }

    const sessIdx = this.index.bySession[record.sessionId];
    sessIdx.calls++;
    sessIdx.costUsd += record.costUsd;
    if (record.verification.verdict === "FABRICATION") {
      sessIdx.fabrications++;
    }
  }

  getIndex(): IndexData {
    return this.index;
  }

  queryTool(tool: string): ToolCallRecord[] {
    const records: ToolCallRecord[] = [];
    const toolIdx = this.index.byTool[tool];
    if (!toolIdx) return records;

    for (const file of toolIdx.files) {
      const filePath = join(this.baseDir, "receipts", file);
      if (!existsSync(filePath)) continue;
      const lines = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record: ToolCallRecord = JSON.parse(line);
          if (record.tool === tool) records.push(record);
        } catch {
          continue;
        }
      }
    }

    return records;
  }

  querySession(sessionId: string): ToolCallRecord[] {
    const records: ToolCallRecord[] = [];
    const files = this.getReceiptFiles();

    for (const file of files) {
      const filePath = join(this.baseDir, "receipts", file);
      if (!existsSync(filePath)) continue;
      const lines = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record: ToolCallRecord = JSON.parse(line);
          if (record.sessionId === sessionId) records.push(record);
        } catch {
          continue;
        }
      }
    }

    return records;
  }

  queryVerdict(
    verdict: "VERIFIED" | "SUSPICIOUS" | "FABRICATION"
  ): ToolCallRecord[] {
    const records: ToolCallRecord[] = [];
    const files = this.getReceiptFiles();

    for (const file of files) {
      const filePath = join(this.baseDir, "receipts", file);
      if (!existsSync(filePath)) continue;
      const lines = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record: ToolCallRecord = JSON.parse(line);
          if (record.verification.verdict === verdict) records.push(record);
        } catch {
          continue;
        }
      }
    }

    return records;
  }

  private getReceiptFiles(): string[] {
    const receiptsDir = join(this.baseDir, "receipts");
    if (!existsSync(receiptsDir)) return [];
    return readdirSync(receiptsDir)
      .filter((f: string) => f.endsWith(".jsonl"))
      .sort()
      .reverse();
  }

  flush(): void {
    this.flushIndex();
  }

  getStats(): {
    totalFiles: number;
    totalCalls: number;
    totalCostUsd: number;
    oldestDate: string | null;
  } {
    const files = this.getReceiptFiles();
    return {
      totalFiles: files.length,
      totalCalls: this.index.totalCalls,
      totalCostUsd: this.index.totalCostUsd,
      oldestDate: files.length > 0 ? files[files.length - 1].replace(".jsonl", "") : null,
    };
  }
}
