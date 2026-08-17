#!/usr/bin/env node
import { watch, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { appendFileSync } from "fs";
import { execSync } from "child_process";
import { createOpenCodeMonitor, scanForSensitiveData } from "@tooloftruth/core";
import type { Detection } from "@tooloftruth/core";

const TOOLOFTRUTH_DIR = process.env.TOOLOFTRUTH_DIR || join(homedir(), ".tooloftruth");
const RECEIPTS_DIR = join(TOOLOFTRUTH_DIR, "receipts");
const STATS_DIR = join(TOOLOFTRUTH_DIR, "stats");
const CONVERSATIONS_DIR = join(TOOLOFTRUTH_DIR, "conversations");
const ALERTS_DIR = join(TOOLOFTRUTH_DIR, "alerts");
const POLL_MS = Number(process.env.TOOLOFTRUTH_POLL_MS || 60000);

if (!existsSync(RECEIPTS_DIR)) mkdirSync(RECEIPTS_DIR, { recursive: true });
if (!existsSync(STATS_DIR)) mkdirSync(STATS_DIR, { recursive: true });
if (!existsSync(CONVERSATIONS_DIR)) mkdirSync(CONVERSATIONS_DIR, { recursive: true });
if (!existsSync(ALERTS_DIR)) mkdirSync(ALERTS_DIR, { recursive: true });

function convFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(CONVERSATIONS_DIR, `${date}.jsonl`);
}

function logConversation(entry: Record<string, unknown>) {
  appendFileSync(convFile(), JSON.stringify(entry) + "\n");
}

function alertsFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(ALERTS_DIR, `${date}.jsonl`);
}

// Builds a self-contained, copy-pasteable alert block. When the user pastes
// this into a chat, an agent has everything needed to investigate without
// reaching into Tool of Truth internals.
function buildAlertBlock(entry: Record<string, unknown>, detection: Detection, sourceDetail: string): string {
  const flag = detection.severity === "critical" ? "🔴" : detection.severity === "warning" ? "🟡" : "ℹ️";
  return [
    "```alert",
    `${flag} TOOL OF TRUTH ALERT`,
    `severity:  ${detection.severity}`,
    `category:  ${detection.category}`,
    `rule:      ${detection.rule}`,
    `confidence: ${Math.round(detection.confidence * 100)}%`,
    `requiresReview: ${detection.requiresReview}`,
    `source:    ${detection.source}`,
    `sourceDetail: ${sourceDetail}`,
    `timestamp: ${entry.timestamp}`,
    `alertId:   ${entry.id}`,
    `matched:   ${detection.matchRedacted}`,
    `rawMatch:  ${JSON.stringify(detection.match)}`,
    `context:   ${detection.context}`,
    "",
    "investigate: check the conversation log at ~/.tooloftruth/conversations/",
    "and receipts at ~/.tooloftruth/receipts/ for this source.",
    "```",
  ].join("\n");
}

function notifySystem(title: string, body: string) {
  try {
    // macOS native notification. Escape for AppleScript.
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `osascript -e 'display notification "${esc(body)}" with title "${esc(title)}"'`;
    execSync(script, { timeout: 5000, stdio: "pipe" });
  } catch {
    // notifications are best-effort; never crash the daemon on failure
  }
}

function logAlert(detection: Detection, sourceDetail: string) {
  const entry = {
    id: detection.id,
    timestamp: new Date().toISOString(),
    severity: detection.severity,
    category: detection.category,
    rule: detection.rule,
    source: detection.source,
    sourceDetail,
    matchRedacted: detection.matchRedacted,
    confidence: detection.confidence,
    requiresReview: detection.requiresReview,
    context: detection.context,
  };
  appendFileSync(alertsFile(), JSON.stringify(entry) + "\n");

  const block = buildAlertBlock(entry, detection, sourceDetail);
  const flag = detection.severity === "critical" ? "🔴" : detection.severity === "warning" ? "🟡" : "ℹ️";
  console.error(`[tooloftruth:daemon] ${flag} ${detection.category}:${detection.rule} (${detection.severity}) — ${detection.matchRedacted} @ ${detection.source}`);
  // Log the full copyable block to a dedicated file the user can grab, and
  // to stdout so it's visible if the daemon is run in a terminal.
  appendFileSync(join(ALERTS_DIR, "latest-alert.txt"), block + "\n\n");
  console.error("\n" + block);

  // Native notification for critical + warning (skip info)
  if (detection.severity !== "info") {
    notifySystem(
      `Tool of Truth: ${detection.category}:${detection.rule}`,
      `${detection.severity.toUpperCase()} — ${detection.matchRedacted}`
    );
  }
}

function scanText(text: string, source: string) {
  if (!text || text.length < 3) return;
  const result = scanForSensitiveData(text, source);
  for (const det of result.detections) {
    logAlert(det, source);
  }
}

// ─── Behavior ledger: per-session model/error-rate tracking ──
const LEDGER_DIR = join(TOOLOFTRUTH_DIR, "ledger");
if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });

interface SessionBehavior {
  sessionId: string;
  model?: string;
  messages: number;
  toolCalls: number;
  errors: number;
  totalTokens: number;
  costUsd: number;
  firstSeen: string;
  lastSeen: string;
}

function ledgerFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(LEDGER_DIR, `${date}.json`);
}

function loadLedger(): Record<string, SessionBehavior> {
  try {
    return JSON.parse(readFileSync(ledgerFile(), "utf-8"));
  } catch {
    return {};
  }
}

function saveLedger(ledger: Record<string, SessionBehavior>) {
  writeFileSync(ledgerFile(), JSON.stringify(ledger, null, 2));
}

function updateLedger(msg: { sessionId: string; model?: string; role: string; tokens: { input: number; output: number }; toolCalls: { isError?: boolean }[]; cost: number }) {
  const ledger = loadLedger();
  const sid = msg.sessionId;
  const entry = ledger[sid] || {
    sessionId: sid,
    messages: 0,
    toolCalls: 0,
    errors: 0,
    totalTokens: 0,
    costUsd: 0,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
  entry.model = msg.model || entry.model;
  entry.messages++;
  entry.toolCalls += msg.toolCalls.length;
  entry.errors += msg.toolCalls.filter((t) => t.isError).length;
  entry.totalTokens += msg.tokens.input + msg.tokens.output;
  entry.costUsd += msg.cost || 0;
  entry.lastSeen = new Date().toISOString();
  ledger[sid] = entry;
  saveLedger(ledger);
}

function formatLedger(ledger: Record<string, SessionBehavior>): string {
  const lines = ["═══ Behavior Ledger ═══", ""];
  for (const s of Object.values(ledger)) {
    const errRate = s.toolCalls > 0 ? Math.round((s.errors / s.toolCalls) * 100) : 0;
    lines.push(
      `  ${s.sessionId.slice(0, 20)}\n` +
      `    model: ${s.model || "-"}\n` +
      `    msgs: ${s.messages}  tools: ${s.toolCalls}  errors: ${s.errors} (${errRate}%)\n` +
      `    tokens: ${s.totalTokens}  cost: $${s.costUsd.toFixed(4)}`
    );
  }
  return lines.join("\n");
}

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

// ─── Git commit secret scanning (gitleaks) ───────────────────
const GIT_SCAN_REPOS: string[] = (
  process.env.TOOLOFTRUTH_GIT_SCAN || ""
).split(",").filter(Boolean);

async function scanGitRepos() {
  if (GIT_SCAN_REPOS.length === 0) return;
  const { gitleaksAvailable, runGitleaksScan } = await import("@tooloftruth/core");
  if (!gitleaksAvailable()) return;
  for (const repo of GIT_SCAN_REPOS) {
    if (!existsSync(repo)) continue;
    try {
      const result = runGitleaksScan(repo, { noGit: false });
      for (const f of result.findings) {
        logAlert(
          {
            id: `gl_${f.Fingerprint || f.RuleID}`,
            category: "secret",
            rule: f.RuleID,
            severity: "critical",
            match: f.Secret,
            matchRedacted: f.Secret.slice(0, 6) + "•••" + f.Secret.slice(-4),
            start: 0,
            end: f.Secret.length,
            source: `gitleaks:${f.File}`,
            confidence: 0.95,
            requiresReview: false,
            context: `${f.File}:${f.StartLine}:${f.StartColumn} — ${(f.Message || "").slice(0, 60)}`,
          },
          `${repo} commit ${(f.Commit || "").slice(0, 8)}`
        );
      }
    } catch {
      // skip
    }
  }
}

// ─── OpenCode conversation monitor ────────────────────────────
let opencodeMonitor: ReturnType<typeof createOpenCodeMonitor> | null = null;

async function initOpenCodeMonitor() {
  try {
    opencodeMonitor = createOpenCodeMonitor({});
    await opencodeMonitor.open();
    console.error("[tooloftruth:daemon] OpenCode monitor connected (opencode.db)");
  } catch (e) {
    console.error(`[tooloftruth:daemon] OpenCode monitor unavailable: ${(e as Error).message}`);
  }
}

async function pollOpenCode() {
  if (!opencodeMonitor) return;
  try {
    const msgs = await opencodeMonitor.pollNewMessages();
    for (const msg of msgs) {
      const entry: Record<string, unknown> = {
        id: `oc_${msg.id}`,
        timestamp: new Date(msg.timeCreated).toISOString(),
        sessionId: `opencode_${msg.sessionId}`,
        type: msg.role === "user" ? "observation" : "result",
        content: (msg.text || `[${msg.role}]`).slice(0, 500),
        role: msg.role,
        model: msg.modelID,
        costUsd: msg.cost,
        tokens: msg.tokens,
        toolCalls: msg.toolCalls,
      };
      logConversation(entry);

      // Update behavior ledger
      updateLedger({
        sessionId: msg.sessionId,
        model: msg.modelID,
        role: msg.role,
        tokens: msg.tokens,
        toolCalls: msg.toolCalls,
        cost: msg.cost,
      });

      // Scan message text for sensitive data
      if (msg.text) {
        scanText(msg.text, `message:${msg.id}`);
      }

      // Also log tool calls as receipts so fabrication audit covers them
      for (const tc of msg.toolCalls) {
        const date = new Date().toISOString().slice(0, 10);
        const receipt = {
          id: `call_oc_${msg.id}_${tc.callID || tc.tool}`,
          timestamp: new Date(msg.timeCreated).toISOString(),
          tool: tc.tool,
          server: "opencode",
          sessionId: `opencode_${msg.sessionId}`,
          userPrompt: msg.text?.slice(0, 200) || "",
          params: tc.input || {},
          result: tc.outputPreview ? { output: tc.outputPreview } : {},
          durationMs: tc.durationMs || 0,
          isError: !!tc.isError,
          tokens: msg.tokens,
          costUsd: 0,
          verification: {
            schemaValid: true,
            responsePlausible: !tc.isError,
            trustScore: tc.isError ? 50 : 95,
            verdict: tc.isError ? "SUSPICIOUS" : "VERIFIED",
            fabricationConfidence: 0,
            checksPerformed: ["opencode_monitor"],
          },
        };
        appendFileSync(join(RECEIPTS_DIR, `${date}.jsonl`), JSON.stringify(receipt) + "\n");

        // Scan tool call input (args/commands) for sensitive data + dangerous commands
        if (tc.input) {
          scanText(JSON.stringify(tc.input), `tool:${tc.tool}`);
        }
      }
    }
    if (msgs.length > 0) {
      console.error(`[tooloftruth:daemon] +${msgs.length} opencode messages, ${msgs.reduce((s, m) => s + m.toolCalls.length, 0)} tool calls`);
    }
  } catch (e) {
    console.error(`[tooloftruth:daemon] opencode poll error: ${(e as Error).message}`);
  }
}

console.error(`[tooloftruth:daemon] Watching ${RECEIPTS_DIR} (poll ${POLL_MS}ms)`);
runOnce();
setInterval(runOnce, POLL_MS);

initOpenCodeMonitor().then(() => {
  pollOpenCode();
  setInterval(pollOpenCode, Math.max(5000, POLL_MS / 2));
});

// Git repo secret scanning — every 5 min
if (GIT_SCAN_REPOS.length > 0) {
  scanGitRepos();
  setInterval(scanGitRepos, 300000);
}

const unwatch = watch(RECEIPTS_DIR, (event, filename) => {
  if (filename && filename.endsWith(".jsonl")) runOnce();
});

process.on("SIGTERM", () => { unwatch.close(); process.exit(0); });
process.on("SIGINT", () => { unwatch.close(); process.exit(0); });