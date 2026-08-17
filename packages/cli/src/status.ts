#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const TOOLOFTRUTH_DIR = join(homedir(), ".tooloftruth");
const RECEIPTS_DIR = join(TOOLOFTRUTH_DIR, "receipts");
const STATS_DIR = join(TOOLOFTRUTH_DIR, "stats");
const CONVERSATIONS_DIR = join(TOOLOFTRUTH_DIR, "conversations");
const INDEX_PATH = join(TOOLOFTRUTH_DIR, "index.json");
const PROXY_PATH = join(TOOLOFTRUTH_DIR, "proxy.json");

function loadIndex(): any {
  if (!existsSync(INDEX_PATH)) return null;
  try { return JSON.parse(readFileSync(INDEX_PATH, "utf-8")); } catch { return null; }
}

function loadProxy(): any {
  if (!existsSync(PROXY_PATH)) return null;
  try { return JSON.parse(readFileSync(PROXY_PATH, "utf-8")); } catch { return null; }
}

function countReceipts(): number {
  if (!existsSync(RECEIPTS_DIR)) return 0;
  const files = readdirSync(RECEIPTS_DIR).filter(f => f.endsWith(".jsonl"));
  let total = 0;
  for (const f of files) {
    const lines = readFileSync(join(RECEIPTS_DIR, f), "utf-8").split("\n").filter(Boolean);
    total += lines.length;
  }
  return total;
}

function countFabrications(): number {
  if (!existsSync(RECEIPTS_DIR)) return 0;
  const files = readdirSync(RECEIPTS_DIR).filter(f => f.endsWith(".jsonl"));
  let count = 0;
  for (const f of files) {
    const lines = readFileSync(join(RECEIPTS_DIR, f), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const r = JSON.parse(line);
        if (r.verification?.verdict === "FABRICATED" || r.verification?.verdict === "FABRICATION_DETECTED") count++;
      } catch {}
    }
  }
  return count;
}

function daemonStatus(): { running: boolean; pid?: number } {
  try {
    const out = execSync("launchctl list | grep tooloftruth", { encoding: "utf-8" }).trim();
    if (!out) return { running: false };
    const [pid] = out.split(/\s+/);
    return { running: true, pid: Number(pid) };
  } catch {
    return { running: false };
  }
}

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 19).replace("T", " ") : "—";
}

console.log("");
console.log("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
console.log("              ◆ TOOL OF TRUTH — STATUS ◆");
console.log("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
console.log("");

const index = loadIndex();
const proxy = loadProxy();
const receipts = countReceipts();
const fabrications = countFabrications();
const daemon = daemonStatus();

console.log(`  Daemon:        ${daemon.running ? `🟢 RUNNING (PID ${daemon.pid})` : "🔴 STOPPED"}`);
console.log(`  Proxy config:  ${proxy ? Object.keys(proxy.servers || {}).join(", ") || "none" : "not found"}`);
console.log(`  Total calls:   ${index?.totalCalls || receipts}`);
console.log(`  Receipts:      ${receipts}`);
console.log(`  Fabrications:  ${fabrications}`);
console.log(`  Total cost:    $${(index?.totalCostUsd || 0).toFixed(4)}`);
console.log(`  Last updated:  ${formatDate(index?.lastUpdated || "")}`);
console.log("");
console.log("  Top tools:");
const byTool = index?.byTool || {};
const top = Object.entries(byTool).sort((a, b) => (b[1].totalCalls || 0) - (a[1].totalCalls || 0)).slice(0, 5);
for (const [name, data] of top) {
  console.log(`    ${name}: ${(data as any).totalCalls || 0} calls, avg trust ${(data as any).avgTrustScore || 0}`);
}
console.log("");
console.log("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
console.log("");
