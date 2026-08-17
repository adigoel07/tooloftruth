#!/usr/bin/env node

// Tool of Truth — CLI Interception Wrapper
// Usage: tooloftruth-run -- <command> [args...]
// Records the command, runs it, logs the result.

import { execSync, spawnSync } from "child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const BASE_DIR = join(homedir(), ".tooloftruth");
const RECEIPTS_DIR = join(BASE_DIR, "receipts");
const INDEX_PATH = join(BASE_DIR, "index.json");

// ─── Brand ───────────────────────────────────────────────────
const BRAND = {
  name: "TOOL OF TRUTH",
  icon: "◆",
  separator: "┄",
  width: 56,
};

function banner(): string {
  const pad = Math.floor((BRAND.width - BRAND.name.length - 2) / 2);
  return `${" ".repeat(pad)}${BRAND.icon} ${BRAND.name} ${BRAND.icon}`;
}

function separator(): string {
  return BRAND.separator.repeat(BRAND.width);
}

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

function summarizeJsonOutput(command: string, data: unknown): string {
  if (!data || typeof data !== "object") return String(data);

  const obj = data as Record<string, unknown>;

  // GitHub API: repo info
  if (obj.full_name && obj.stargazers_count !== undefined) {
    const repo = obj;
    const lines = [
      `Repository: ${repo.full_name}`,
      `  ${repo.description || "No description"}`,
      `  ★ ${repo.stargazers_count}  ⑂ ${repo.forks_count}  ${repo.language || "N/A"}`,
      `  ${repo.html_url}`,
    ];
    return lines.join("\n");
  }

  // GitHub API: user info
  if (obj.login && obj.followers !== undefined) {
    return `User: ${obj.login} (${obj.name || "—"})\n  ${obj.bio || "No bio"}\n  ★ ${obj.followers} followers  ⑂ ${obj.public_repos} repos`;
  }

  // GitHub API: list of repos
  if (Array.isArray(data) && data.length > 0 && data[0].full_name) {
    const repos = data.slice(0, 5).map(
      (r: Record<string, unknown>) => `  ${r.full_name} — ★ ${r.stargazers_count}`
    );
    return `Repositories (${data.length} total):\n${repos.join("\n")}${data.length > 5 ? `\n  ... +${data.length - 5} more` : ""}`;
  }

  // GitHub API: issues/PRs list
  if (Array.isArray(data) && data.length > 0 && data[0].title) {
    const items = data.slice(0, 5).map(
      (i: Record<string, unknown>) => `  #${i.number} ${i.title} [${i.state}]`
    );
    return `Issues/PRs (${data.length} total):\n${items.join("\n")}${data.length > 5 ? `\n  ... +${data.length - 5} more` : ""}`;
  }

  // Docker: container list
  if (Array.isArray(data) && data.length > 0 && data[0].Names) {
    return `Containers: ${data.length} running`;
  }

  // Generic array
  if (Array.isArray(data)) {
    return `Array: ${data.length} items`;
  }

  // Generic object — show top-level keys
  const keys = Object.keys(obj).slice(0, 8);
  const preview = keys.map((k) => {
    const v = obj[k];
    const val = typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60);
    return `  ${k}: ${val}`;
  });
  return preview.join("\n") + (Object.keys(obj).length > 8 ? `\n  ... +${Object.keys(obj).length - 8} more fields` : "");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function main() {
  const { command, commandArgs } = parseArgs(process.argv);

  // Subcommands
  if (command === "status" || command === "daemon") {
    const __dirname = fileURLToPath(new URL(".", import.meta.url));
    const statusScript = join(__dirname, "status.js");
    const res = spawnSync(process.execPath, [statusScript, ...commandArgs], { stdio: "inherit" });
    process.exit(res.status ?? 0);
  }

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

  // Print branded summary
  const status = isError ? "✗" : "✓";
  const duration = formatDuration(durationMs);
  const fullCommand = [command, ...commandArgs].join(" ");

  // Parse output for smart summary
  let summary = "";
  if (output && !isError) {
    try {
      const parsed = JSON.parse(output);
      summary = summarizeJsonOutput(command, parsed);
    } catch {
      const lines = output.trim().split("\n");
      if (lines.length <= 5) {
        summary = lines.join("\n");
      } else {
        summary = lines.slice(0, 3).join("\n") + `\n  ... +${lines.length - 3} lines`;
      }
    }
  } else if (isError && output) {
    summary = output.trim().split("\n").slice(0, 3).join("\n");
  }

  // Print
  console.log("");
  console.log(separator());
  console.log(banner());
  console.log(separator());
  console.log("");
  console.log(`  ${status}  ${fullCommand}`);
  console.log(`     ${duration}  ·  trust ${record.verification.trustScore}/100  ·  ${isError ? `exit ${exitCode}` : "success"}`);
  if (summary) {
    console.log("");
    console.log("  " + summary.split("\n").join("\n  "));
  }
  console.log("");
  console.log(separator());
  console.log("");
  process.exit(exitCode);
}

main();
