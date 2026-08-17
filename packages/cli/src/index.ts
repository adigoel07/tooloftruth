#!/usr/bin/env node

// Tool of Truth — CLI Interception Wrapper
// Usage: tooloftruth-run -- <command> [args...]
// Records the command, runs it, logs the result.

import { execSync } from "child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BASE_DIR = join(homedir(), ".tooloftruth");
const RECEIPTS_DIR = join(BASE_DIR, "receipts");
const INDEX_PATH = join(BASE_DIR, "index.json");

function ensureDirs() {
  if (!existsSync(RECEIPTS_DIR)) mkdirSync(RECEIPTS_DIR, { recursive: true });
}

function generateId() {
  return `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadIndex() {
  if (existsSync(INDEX_PATH)) {
    try { return JSON.parse(readFileSync(INDEX_PATH, "utf-8")); }
    catch { /* ignore */ }
  }
  return { lastUpdated: new Date().toISOString(), totalCalls: 0, totalCostUsd: 0, byTool: {}, bySession: {} };
}

function saveIndex(index: ReturnType<typeof loadIndex>) {
  index.lastUpdated = new Date().toISOString();
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function parseArgs(args: string[]): { command: string; commandArgs: string[] } {
  // Skip 'node' and script path
  const scriptArgs = args.slice(2);

  if (scriptArgs[0] === "--") {
    const [command, ...commandArgs] = scriptArgs.slice(1);
    return { command: command || "unknown", commandArgs };
  }

  // If no --, treat everything after node/script as the command
  const [command, ...commandArgs] = scriptArgs;
  return { command: command || "unknown", commandArgs };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function main() {
  const { command, commandArgs } = parseArgs(process.argv);

  if (!command || command === "--help") {
    console.log("Tool of Truth — CLI Interception Wrapper");
    console.log("");
    console.log("Usage: tooloftruth-run -- <command> [args...]");
    console.log("");
    console.log("Examples:");
    console.log("  tooloftruth-run -- gh api repos/user/repo");
    console.log("  tooloftruth-run -- curl https://api.example.com/data");
    console.log("  tooloftruth-run -- docker ps");
    console.log("");
    console.log("Records the command, runs it, logs the result to Tool of Truth.");
    process.exit(0);
  }

  ensureDirs();

  const startTime = Date.now();
  const id = generateId();
  const timestamp = new Date().toISOString();
  let exitCode = 0;
  let output = "";
  let isError = false;

  try {
    const fullCommand = [command, ...commandArgs].join(" ");
    output = execSync(fullCommand, {
      stdio: "pipe",
      timeout: 300000, // 5 min timeout
      env: process.env,
    }).toString();
  } catch (err: any) {
    exitCode = err.status || 1;
    isError = true;
    output = err.stderr ? err.stderr.toString() : err.message || "Command failed";
  }

  const durationMs = Date.now() - startTime;

  // Write receipt
  const record = {
    id,
    timestamp,
    tool: command,
    server: "cli",
    sessionId: `cli_session_${timestamp.slice(0, 10)}`,
    userPrompt: `[CLI] ${command} ${commandArgs.join(" ")}`.slice(0, 200),
    params: { command, args: commandArgs },
    result: { output: output.slice(0, 5000), exitCode, outputLength: output.length },
    durationMs,
    isError,
    tokens: { input: 0, output: 0 },
    costUsd: 0,
    verification: {
      schemaValid: true,
      responsePlausible: !isError,
      trustScore: isError ? 50 : 95,
      verdict: isError ? "SUSPICIOUS" : "VERIFIED",
      fabricationConfidence: 0,
      checksPerformed: ["cli_execution"],
    },
  };

  const date = timestamp.slice(0, 10);
  const filePath = join(RECEIPTS_DIR, `${date}.jsonl`);
  appendFileSync(filePath, JSON.stringify(record) + "\n");

  // Update index
  const index = loadIndex();
  index.totalCalls++;
  if (!index.byTool[command]) {
    index.byTool[command] = {
      totalCalls: 0,
      totalCostUsd: 0,
      lastCalled: timestamp,
      avgTrustScore: 0,
      fabricationsDetected: 0,
      files: [],
    };
  }
  const toolIdx = index.byTool[command];
  toolIdx.totalCalls++;
  toolIdx.lastCalled = timestamp;
  toolIdx.avgTrustScore = Math.round(
    (toolIdx.avgTrustScore * (toolIdx.totalCalls - 1) + record.verification.trustScore) /
    toolIdx.totalCalls
  );
  if (!toolIdx.files.includes(`${date}.jsonl`)) {
    toolIdx.files.push(`${date}.jsonl`);
  }
  saveIndex(index);

  // Print summary
  const status = isError ? "✗" : "✓";
  const duration = formatDuration(durationMs);
  console.log(`\n[Tool of Truth] ${status} ${command} — ${duration} — trust ${record.verification.trustScore}/100`);

  // Output the real command output
  if (output) {
    process.stdout.write(output);
  }

  process.exit(exitCode);
}

main();
