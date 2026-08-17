#!/usr/bin/env node
import { watch, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TOOLOFTRUTH_DIR = process.env.TOOLOFTRUTH_DIR || join(homedir(), ".tooloftruth");
const RECEIPTS_DIR = join(TOOLOFTRUTH_DIR, "receipts");
const STATS_DIR = join(TOOLOFTRUTH_DIR, "stats");
const POLL_MS = Number(process.env.TOOLOFTRUTH_POLL_MS || 60000);

if (!existsSync(RECEIPTS_DIR)) mkdirSync(RECEIPTS_DIR, { recursive: true });
if (!existsSync(STATS_DIR)) mkdirSync(STATS_DIR, { recursive: true });

interface Summary {
  windowStart: string;
  windowEnd: string;
  totalCalls: number;
  byVerdict: Record<string, number>;
  fabricationsDetected: number;
  totalCostUsd: number;
  tools: Record<string, number>;
}

function summarize(calls: any[]): Summary {
  const byVerdict: Record<string, number> = {};
  const tools: Record<string, number> = {};
  let fabricationsDetected = 0;
  let totalCostUsd = 0;

  for (const c of calls) {
    const verdict = c.verification?.verdict || "UNKNOWN";
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
    if (verdict === "FABRICATED" || verdict === "FABRICATION_DETECTED") fabricationsDetected++;
    totalCostUsd += c.costUsd || 0;
    tools[c.tool || "unknown"] = (tools[c.tool || "unknown"] || 0) + 1;
  }

  return {
    windowStart: new Date().toISOString(),
    windowEnd: new Date().toISOString(),
    totalCalls: calls.length,
    byVerdict,
    fabricationsDetected,
    totalCostUsd,
    tools,
  };
}

function readReceipts(): any[] {
  try {
    const files = readdirSync(RECEIPTS_DIR).filter((f) => f.endsWith(".jsonl"));
    const calls: any[] = [];
    for (const f of files) {
      const lines = readFileSync(join(RECEIPTS_DIR, f), "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try { calls.push(JSON.parse(line)); } catch { /* skip */ }
      }
    }
    return calls;
  } catch {
    return [];
  }
}

function writeSummary(s: Summary) {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(STATS_DIR, `${date}.json`);
  let hist: Summary[] = [];
  try { hist = JSON.parse(readFileSync(file, "utf-8")); } catch { hist = []; }
  hist.push(s);
  writeFileSync(file, JSON.stringify(hist, null, 2));
}

function runOnce() {
  const calls = readReceipts();
  if (calls.length === 0) return;
  const s = summarize(calls);
  writeSummary(s);
  if (s.fabricationsDetected > 0) {
    console.error(`[tooloftruth:daemon] ⚠ ${s.fabricationsDetected} fabrication(s) detected across ${calls.length} calls`);
  } else {
    console.error(`[tooloftruth:daemon] ${calls.length} calls seen, 0 fabrications, $${s.totalCostUsd.toFixed(4)}`);
  }
}

console.error(`[tooloftruth:daemon] Watching ${RECEIPTS_DIR} (poll ${POLL_MS}ms)`);
runOnce();
setInterval(runOnce, POLL_MS);

const unwatch = watch(RECEIPTS_DIR, (event, filename) => {
  if (filename && filename.endsWith(".jsonl")) runOnce();
});

process.on("SIGTERM", () => { unwatch.close(); process.exit(0); });
process.on("SIGINT", () => { unwatch.close(); process.exit(0); });