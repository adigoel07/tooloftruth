import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "path";
import { homedir } from "os";
import {
  Verifier,
  ReceiptStore,
  loadAllManifests,
  buildReceipt,
  buildCostBreakdown,
  formatCostReport,
  formatReceiptHuman,
  calculateCost,
  detectDeepFabrication,
  verifyOutcome,
  SatisfactionTracker,
  calculateReliability,
  formatReliability,
  ConversationLogger,
  crossReferenceClaims,
  formatClaimVerifications,
  extractClaims,
  classifyClaim,
  assessEvidence,
  calculateCredibility,
  determineVerdict,
  classifyInput,
  assessScientificRigor,
  generateSuggestions,
  formatTruthScanResult,
  verifyClaimAgainstSources,
  calculateCredibilityWithSources,
} from "@tooloftruth/core";
import type { TruthScanResult, ClaimAnalysis, ScanOptions } from "@tooloftruth/core";
import type { ToolCallRecord, TokenUsage } from "@tooloftruth/core";
import { McpProxy } from "./proxy.js";
import { discoverDownstreamServers, generateProxyConfig } from "./discovery.js";
import { writeFileSync, existsSync } from "fs";
import {
  checkManifestCall,
  formatManifestResult,
} from "@tooloftruth/core";
import type { ManifestCheckResult } from "@tooloftruth/core";

const TOOLOFTRUTH_DIR = join(homedir(), ".tooloftruth");

const verifier = new Verifier();
const store = new ReceiptStore(TOOLOFTRUTH_DIR);
const manifests = loadAllManifests(TOOLOFTRUTH_DIR);
const proxy = new McpProxy(TOOLOFTRUTH_DIR);
const satisfaction = new SatisfactionTracker();

const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const convLogger = new ConversationLogger(TOOLOFTRUTH_DIR, sessionId);

const sessionCalls: ToolCallRecord[] = [];

function recordCall(record: ToolCallRecord): void {
  record.sessionId = sessionId;
  sessionCalls.push(record);
  store.appendCall(record);
}

const server = new McpServer({
  name: "tooloftruth",
  version: "0.1.0",
});

// ─── Tool of Truth's own tools ────────────────────────────────

server.tool(
  "tooloftruth_verify",
  "Verify that a specific tool was actually used in this session",
  { tool: z.string().describe("Name of the tool to verify") },
  async ({ tool }) => {
    const calls = sessionCalls.filter(
      (c) => c.tool === tool || c.server === tool
    );
    const latest = calls[calls.length - 1];

    if (!latest) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                verified: false,
                trustScore: 0,
                verdict: "UNVERIFIABLE",
                detail: `No calls to '${tool}' found in this session.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              verified: latest.verification.verdict === "VERIFIED",
              trustScore: latest.verification.trustScore,
              verdict: latest.verification.verdict,
              calls: calls.length,
              latestCall: {
                timestamp: latest.timestamp,
                durationMs: latest.durationMs,
                isError: latest.isError,
                costUsd: latest.costUsd,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_check",
  "Pre-flight check: is a tool installed and configured?",
  { tool: z.string().describe("Name of the tool to check") },
  async ({ tool }) => {
    const result = await verifier.checkPreflight(tool);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_receipt",
  "Generate or view a verification receipt",
  {
    action: z.enum(["generate", "view", "list"]).describe("Action to perform"),
    receiptId: z.string().optional().describe("Receipt ID (for view)"),
  },
  async ({ action, receiptId }) => {
    if (action === "generate") {
      const receipt = buildReceipt(
        sessionCalls,
        { name: "unknown", version: "0.1.0", sessionId },
        { name: "unknown", type: "mcp", installed: true, configured: true }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: formatReceiptHuman(receipt),
          },
        ],
      };
    }

    if (action === "list") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              sessionCalls.map((c) => ({
                id: c.id,
                tool: c.tool,
                server: c.server,
                verdict: c.verification.verdict,
                trustScore: c.verification.trustScore,
                timestamp: c.timestamp,
              })),
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: receiptId
            ? `Receipt '${receiptId}' — full view coming in v2.`
            : "Provide a receiptId to view.",
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_cost",
  "Get cost breakdown for tool usage in this session",
  {
    period: z
      .enum(["session", "day", "week"])
      .default("session")
      .describe("Time period"),
    tool: z.string().optional().describe("Filter by specific tool"),
  },
  async ({ tool }) => {
    const filtered = tool
      ? sessionCalls.filter((c) => c.tool === tool || c.server === tool)
      : sessionCalls;
    const breakdown = buildCostBreakdown(filtered);
    return {
      content: [
        { type: "text" as const, text: formatCostReport(breakdown) },
      ],
    };
  }
);

server.tool(
  "tooloftruth_history",
  "Search historical verification receipts",
  {
    tool: z.string().optional().describe("Filter by tool"),
    limit: z.number().default(20).describe("Max results"),
  },
  async ({ tool, limit }) => {
    const records = tool ? store.queryTool(tool) : sessionCalls;
    const sliced = records.slice(-limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: sliced.length,
              records: sliced.map((r: ToolCallRecord) => ({
                id: r.id,
                tool: r.tool,
                server: r.server,
                timestamp: r.timestamp,
                verdict: r.verification.verdict,
                trustScore: r.verification.trustScore,
                costUsd: r.costUsd,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_truth",
  "Full session truth report — everything that happened",
  {},
  async () => {
    const stats = store.getStats();
    const satResults = satisfaction.getAllResults();
    const satisfactionSummary = Array.from(satResults.entries()).map(
      ([id, r]) => ({
        toolCallId: id,
        satisfied: r.satisfied,
        confidence: r.confidence,
        signals: r.signals,
      })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sessionId,
              totalCalls: sessionCalls.length,
              verified: sessionCalls.filter(
                (c) => c.verification.verdict === "VERIFIED"
              ).length,
              fabricated: sessionCalls.filter(
                (c) => c.verification.verdict === "FABRICATION"
              ).length,
              suspicious: sessionCalls.filter(
                (c) => c.verification.verdict === "SUSPICIOUS"
              ).length,
              totalCostUsd: sessionCalls.reduce(
                (s, c) => s + c.costUsd,
                0
              ),
              totalTokens: {
                input: sessionCalls.reduce(
                  (s, c) => s + c.tokens.input,
                  0
                ),
                output: sessionCalls.reduce(
                  (s, c) => s + c.tokens.output,
                  0
                ),
              },
              satisfaction: satisfactionSummary,
              historicalStats: stats,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_satisfaction",
  "Report user satisfaction for the last tool call based on their follow-up message",
  {
    message: z.string().describe("The user's follow-up message after a tool result"),
    toolCallId: z.string().optional().describe("Specific tool call ID (defaults to most recent)"),
  },
  async ({ message, toolCallId }) => {
    const callId =
      toolCallId ||
      sessionCalls[sessionCalls.length - 1]?.id ||
      "unknown";

    const result = satisfaction.inferFromNextMessage(callId, message);

    // Persist so behavior-insights can correlate satisfaction by tool/model.
    const call = sessionCalls.find((c) => c.id === callId);
    const { persistSatisfaction } = await import("@tooloftruth/core");
    persistSatisfaction({
      toolCallId: callId,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      tool: call?.tool,
      server: call?.server,
      model: undefined,
      satisfied: result.satisfied,
      confidence: result.confidence,
      signals: result.signals,
    }, TOOLOFTRUTH_DIR);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              toolCallId: callId,
              satisfied: result.satisfied,
              confidence: Math.round(result.confidence * 100),
              signals: result.signals,
              interpretation:
                result.satisfied === true
                  ? "User appears satisfied with the tool result"
                  : result.satisfied === false
                    ? "User appears dissatisfied — result may be wrong"
                    : "Cannot determine user satisfaction",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_outcome",
  "Verify if a tool result matches what the user asked for",
  {
    prompt: z.string().describe("The user's original prompt/request"),
    toolCallId: z.string().optional().describe("Tool call ID to check"),
  },
  async ({ prompt, toolCallId }) => {
    const call = toolCallId
      ? sessionCalls.find((c) => c.id === toolCallId)
      : sessionCalls[sessionCalls.length - 1];

    if (!call) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: "No tool call found to verify" },
              null,
              2
            ),
          },
        ],
      };
    }

    const toolDef = proxy.getTools().find(
      (t) => t.originalName === call.tool && t.serverName === call.server
    );

    const outcome = verifyOutcome(prompt, call.result, toolDef?.description);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              toolCallId: call.id,
              tool: call.tool,
              server: call.server,
              aligned: outcome.aligned,
              confidence: Math.round(outcome.confidence * 100),
              issues: outcome.issues,
              interpretation: outcome.aligned
                ? "Tool result matches the user's request"
                : `Tool result has issues: ${outcome.issues.join("; ")}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_reliability",
  "Get tool reliability scores — success rate, fabrication rate, grade",
  {},
  async () => {
    const allCalls = [...sessionCalls];
    // Also include historical calls from today
    const today = new Date().toISOString().slice(0, 10);
    const todayHistorical = store.queryTool("");
    for (const c of todayHistorical) {
      if (c.timestamp.startsWith(today) && !allCalls.find((e) => e.id === c.id)) {
        allCalls.push(c);
      }
    }

    const reliability = calculateReliability(allCalls);
    return {
      content: [
        { type: "text" as const, text: formatReliability(reliability) },
      ],
    };
  }
);

server.tool(
  "tooloftruth_log_claim",
  "Log a tool usage claim from the agent for later verification",
  {
    tool: z.string().describe("Name of the tool being claimed"),
    context: z.string().describe("What the agent said about using this tool"),
  },
  async ({ tool, context }) => {
    const entry = convLogger.logClaim(tool, context);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              logged: true,
              claimId: entry.id,
              timestamp: entry.timestamp,
              tool,
              message: `Claim logged. Use tooloftruth_audit to verify against actual tool calls.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_log_action",
  "Log an action the agent is performing for audit trail",
  {
    action: z.string().describe("Description of the action being performed"),
  },
  async ({ action }) => {
    const entry = convLogger.logAction(action);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ logged: true, actionId: entry.id, timestamp: entry.timestamp }),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_audit",
  "Cross-reference agent claims against actual tool calls — detects fabrication",
  {},
  async () => {
    const claims = convLogger.getClaims();
    const toolCallsForCrossRef = sessionCalls.map((c) => ({
      tool: c.tool,
      server: c.server,
      timestamp: c.timestamp,
    }));

    const verifications = crossReferenceClaims(claims, toolCallsForCrossRef);

    const fabricated = verifications.filter((v) => v.verdict === "FABRICATION");
    const verified = verifications.filter((v) => v.verdict === "VERIFIED");

    return {
      content: [
        {
          type: "text" as const,
          text: formatClaimVerifications(verifications) +
            `\n\nTool calls this session: ${sessionCalls.length}` +
            `\nClaims made: ${claims.length}` +
            `\nFabrications detected: ${fabricated.length}` +
            `\nVerified claims: ${verified.length}`,
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_conversation",
  "View the conversation log for this session",
  {
    limit: z.number().default(20).describe("Max entries to return"),
    type: z.enum(["all", "claims", "actions", "results"]).default("all").describe("Filter by type"),
  },
  async ({ limit, type }) => {
    let entries = convLogger.getEntries();
    if (type !== "all") {
      const filterType = type === "claims" ? "claim" : type === "actions" ? "action" : "result";
      entries = entries.filter((e) => e.type === filterType);
    }
    entries = entries.slice(-limit);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: entries.length,
              entries: entries.map((e) => ({
                id: e.id,
                timestamp: e.timestamp,
                type: e.type,
                content: e.content.slice(0, 200),
                toolMentioned: e.toolMentioned,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_alerts",
  "List sensitive-data alerts (PII, secrets, prompt injection, dangerous commands) detected by the daemon",
  {
    limit: z.number().default(20).describe("Max alerts to return"),
    severity: z.enum(["critical", "warning", "info"]).optional().describe("Filter by severity"),
    category: z.enum(["secret", "pii", "prompt_injection", "dangerous_command"]).optional().describe("Filter by category"),
  },
  async ({ limit, severity, category }) => {
    const { readdirSync, readFileSync } = await import("fs");
    const alertsDir = join(TOOLOFTRUTH_DIR, "alerts");
    let alerts: Record<string, unknown>[] = [];
    try {
      const files = readdirSync(alertsDir).filter((f) => f.endsWith(".jsonl")).sort().reverse();
      for (const f of files) {
        const lines = readFileSync(join(alertsDir, f), "utf-8").split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (severity && entry.severity !== severity) continue;
            if (category && entry.category !== category) continue;
            alerts.push(entry);
          } catch {}
        }
        if (alerts.length >= limit) break;
      }
    } catch {
      alerts = [];
    }

    const summary = alerts.slice(0, limit);
    const counts = alerts.reduce((acc, a) => {
      acc[a.category as string] = (acc[a.category as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total: alerts.length,
              byCategory: counts,
              alerts: summary.map((a) => ({
                severity: a.severity,
                category: a.category,
                rule: a.rule,
                matchRedacted: a.matchRedacted,
                source: a.source,
                timestamp: a.timestamp,
                confidence: a.confidence,
                requiresReview: a.requiresReview,
                context: a.context,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_gitleaks",
  "Deep-scan a git repo for secrets using gitleaks (200+ rules). Returns findings with exact file/line proof.",
  {
    repoPath: z.string().describe("Absolute path to the git repo to scan"),
    noGit: z.boolean().optional().describe("Scan a directory without git history (gitleaks dir)"),
  },
  async ({ repoPath, noGit }) => {
    const { gitleaksAvailable, runGitleaksScan, formatGitleaksFindings } = await import("@tooloftruth/core");
    if (!gitleaksAvailable()) {
      return {
        content: [{ type: "text" as const, text: "gitleaks not installed. Run `brew install gitleaks` first." }],
      };
    }
    const result = runGitleaksScan(repoPath, { noGit });
    const summary = {
      available: result.available,
      findingCount: result.findings.length,
      scannedAt: result.scannedAt,
      report: formatGitleaksFindings(result),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  "tooloftruth_ledger",
  "Per-session behavior ledger: models used, message/tool-call counts, error rates, token usage, cost",
  {},
  async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const ledgerDir = join(TOOLOFTRUTH_DIR, "ledger");
    let ledger: Record<string, unknown> = {};
    try {
      const files = readdirSync(ledgerDir).filter((f) => f.endsWith(".json")).sort().reverse();
      if (files.length > 0) {
        ledger = JSON.parse(readFileSync(join(ledgerDir, files[0]), "utf-8"));
      }
    } catch {
      ledger = {};
    }
    const sessions = Object.values(ledger);
    const totalTokens = sessions.reduce((s, x) => s + (x as any).totalTokens || 0, 0);
    const totalCost = sessions.reduce((s, x) => s + (x as any).costUsd || 0, 0);
    const totalErrors = sessions.reduce((s, x) => s + (x as any).errors || 0, 0);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sessions: sessions.length,
              totalTokens,
              totalCostUsd: totalCost,
              totalErrors,
              bySession: sessions,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_insights",
  "Model behavior insights: regression flags, per-model error rates, token/cost drift",
  {},
  async () => {
    const { computeBehaviorInsights, formatBehaviorInsights } = await import("@tooloftruth/core");
    const insights = computeBehaviorInsights(TOOLOFTRUTH_DIR);
    return {
      content: [{ type: "text" as const, text: formatBehaviorInsights(insights) }],
    };
  }
);

server.tool(
  "tooloftruth_budget",
  "View or set the daily spend budget — when crossed, the daemon flags it",
  {
    action: z.enum(["get", "set", "status"]).default("get").describe("get=view config, status=live spend, set=set daily limit"),
    dailyLimitUsd: z.number().min(0).optional().describe("Daily budget in USD (0 disables)"),
  },
  async ({ action, dailyLimitUsd }) => {
    const { loadBudgetConfig, formatBudgetConfig, setBudgetLimit, computeBudgetStatus, formatBudgetStatus } = await import("@tooloftruth/core");
    const dir = TOOLOFTRUTH_DIR;
    if (action === "set") {
      const cfg = setBudgetLimit(dailyLimitUsd ?? 0, dir);
      return {
        content: [{ type: "text" as const, text: `Budget set.\n\n${formatBudgetConfig(cfg)}\n\n${formatBudgetStatus(computeBudgetStatus(dir))}` }],
      };
    }
    if (action === "status") {
      return { content: [{ type: "text" as const, text: formatBudgetStatus(computeBudgetStatus(dir)) }] };
    }
    return { content: [{ type: "text" as const, text: formatBudgetConfig(loadBudgetConfig(dir)) }] };
  }
);

server.tool(
  "tooloftruth_alert_config",
  "View or update alert configuration — which detection types produce alerts",
  {
    action: z.enum(["get", "set", "enable", "disable"]).default("get").describe("get=view, set=update, enable/disable=a category or master"),
    category: z.enum(["secret", "pii", "prompt_injection", "dangerous_command", "filesystem_action", "install_action"]).optional().describe("Detection category to enable/disable"),
    enabled: z.boolean().optional().describe("Master on/off (for set)"),
    notifyCritical: z.boolean().optional().describe("Critical alerts → native notification"),
    notifyWarning: z.boolean().optional().describe("Warning alerts → native notification"),
  },
  async ({ action, category, enabled, notifyCritical, notifyWarning }) => {
    const { loadAlertConfig, updateAlertConfig, shouldAlert, formatAlertConfig } = await import("@tooloftruth/core");
    const dir = TOOLOFTRUTH_DIR;

    if (action === "get") {
      const cfg = loadAlertConfig(dir);
      return { content: [{ type: "text" as const, text: formatAlertConfig(cfg) }] };
    }

    // enable/disable: either a category or the master switch
    const cfg = loadAlertConfig(dir);
    if (action === "enable" || action === "disable") {
      const on = action === "enable";
      if (category) {
        const updated = updateAlertConfig({ category, categoryEnabled: on }, dir);
        return {
          content: [{
            type: "text" as const,
            text: `Category '${category}' ${on ? "enabled" : "disabled"}.\n\n${formatAlertConfig(updated)}`,
          }],
        };
      }
      // master switch
      const updated = updateAlertConfig({ enabled: on }, dir);
      return {
        content: [{
          type: "text" as const,
          text: `Alerts ${on ? "enabled" : "disabled"} globally.\n\n${formatAlertConfig(updated)}`,
        }],
      };
    }

    // set
    const updated = updateAlertConfig({ enabled, notifyCritical, notifyWarning }, dir);
    return {
      content: [{
        type: "text" as const,
        text: `Alert config updated.\n\n${formatAlertConfig(updated)}`,
      }],
    };
  }
);

server.tool(
  "tooloftruth_truth_scan",
  "Scan text for factual claims, verify them against real web sources using Crawl4AI, and produce a truth report with scientific framework analysis",
  {
    text: z.string().describe("Text to scan for truth — can be facts, claims, code, research, or opinions"),
    depth: z.enum(["quick", "standard", "deep"]).default("standard").describe("Scan depth: quick (fast, no crawl), standard (crawl top 3 sources per claim), deep (crawl top 5, deeper analysis)"),
  },
  async ({ text, depth }) => {
    const inputType = classifyInput(text);
    const claimTexts = extractClaims(text);

    // Limit claims based on depth
    const maxClaims = depth === "quick" ? 3 : depth === "standard" ? 5 : 10;
    const claimsToScan = claimTexts.slice(0, maxClaims);

    const claims: ClaimAnalysis[] = [];

    for (const claimText of claimsToScan) {
      const evidence = assessEvidence(claimText);
      const claimType = classifyClaim(claimText);

      let sources: Source[] = [];
      let evidenceTexts: string[] = [];

      // Use Crawl4AI for web verification (skip for quick mode)
      if (depth !== "quick") {
        const maxSources = depth === "deep" ? 5 : 3;
        const verification = verifyClaimAgainstSources(claimText, maxSources);
        sources = verification.sources;
        evidenceTexts = verification.evidenceTexts;
      }

      const credibility = calculateCredibilityWithSources(
        claimText,
        sources,
        evidence,
        evidenceTexts
      );

      claims.push({
        claim: claimText,
        score: credibility.score,
        verdict: credibility.score >= 70 ? "supported" : credibility.score >= 40 ? "unverifiable" : "unsupported",
        evidence: [...evidence.notes, ...evidenceTexts],
        sources: sources.map((s) => s.url),
        reasoning: `Claim type: ${claimType}. ${evidence.hasEvidence ? `In-text evidence: ${evidence.evidenceType}` : "No in-text evidence."} ${credibility.factors.join(". ")}`,
      });
    }

    // Calculate overall score
    const overallScore = claims.length > 0
      ? Math.round(claims.reduce((s, c) => s + c.score, 0) / claims.length)
      : 50;

    const scientific = depth !== "quick" ? assessScientificRigor(text) : undefined;

    // Collect all sources for the report
    const allSources: Source[] = claims.flatMap((c) =>
      c.sources.map((url) => ({
        url,
        title: "",
        snippet: "",
        relevance: 0.5,
        reliability: 0.5,
      }))
    );

    const result: TruthScanResult = {
      id: `scan_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      input: text.slice(0, 500),
      inputType,
      overallScore,
      confidence: Math.min(95, Math.max(20, overallScore)),
      verdict: determineVerdict(overallScore),
      claims,
      sources: allSources,
      suggestions: generateSuggestions(claims, allSources, scientific),
      methodology: depth === "deep"
        ? "Deep scan: Crawl4AI crawling top 5 sources per claim, full claim extraction, evidence assessment, scientific framework analysis"
        : depth === "standard"
          ? "Standard scan: Crawl4AI crawling top 3 sources per claim, claim extraction, evidence assessment, credibility scoring"
          : "Quick scan: basic claim extraction and classification (no web crawl)",
    };

    return {
      content: [
        { type: "text" as const, text: formatTruthScanResult(result) },
      ],
    };
  }
);

// ─── Proxy: register downstream tools ────────────────────────

async function registerProxyTools(): Promise<void> {
  if (!proxy.isConnected()) return;

  const tools = proxy.getTools();
  for (const tool of tools) {
    const toolName = tool.name;
    const desc = `[proxied via ${tool.serverName}] ${tool.description}`;

    // Build a Zod schema from JSON Schema properties
    const inputSchema = jsonSchemaToZod(tool.inputSchema);

    server.tool(
      toolName,
      desc,
      inputSchema,
      async (args: Record<string, unknown>) => {
        const toolDef = proxy.getTools().find((t) => t.name === toolName);

        // ─── Manifest enforcement (pre-call) ─────────────────────
        const manifest = manifests.get(tool.serverName);
        let manifestResult: ManifestCheckResult | null = null;
        if (manifest) {
          // Arg + budget check against this tool's expected args
          manifestResult = checkManifestCall(
            manifest,
            tool.originalName,
            tool.serverName,
            args,
            0,
            null
          );
          if (!manifestResult.allowed) {
            // Block the call — it violates the manifest
            const violation = manifestResult.violations[0];
            const blockedRecord: ToolCallRecord = {
              id: `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toISOString(),
              tool: tool.originalName,
              server: tool.serverName,
              sessionId,
              userPrompt: "",
              params: args,
              result: { error: "BLOCKED_BY_MANIFEST" },
              durationMs: 0,
              isError: true,
              tokens: { input: 0, output: 0 },
              costUsd: 0,
              verification: {
                schemaValid: false,
                responsePlausible: false,
                trustScore: 0,
                verdict: "FABRICATION",
                fabricationConfidence: 1,
                checksPerformed: ["manifest_enforcement"],
              },
            };
            recordCall(blockedRecord);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: "BLOCKED_BY_MANIFEST",
                      skill: manifest.skill,
                      violation: violation?.type,
                      detail: violation?.detail,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const { result, durationMs, isError, record } =
          await proxy.callTool(toolName, args);

        // ─── Manifest enforcement (post-call: output rules + cost) ─
        if (manifest) {
          manifestResult = checkManifestCall(
            manifest,
            tool.originalName,
            tool.serverName,
            args,
            record.costUsd,
            record.result
          );
        }

        // Deep fabrication detection
        const deepSignals = detectDeepFabrication(
          record,
          toolDef?.description
        );
        const deepConfidence = deepSignals
          .filter((s) => s.triggered)
          .reduce((sum, s) => sum + s.weight, 0);

        // Outcome verification
        const outcome = verifyOutcome(
          record.userPrompt || "",
          record.result,
          toolDef?.description
        );

        // Trust scoring with deep signals
        const invocationOk = record.durationMs > 0 && !record.isError;
        const outputOk = record.result !== null && record.result !== undefined;
        const trust = verifier.calculateTrustScore(
          invocationOk,
          outputOk,
          deepSignals,
          true
        );

        const manifestViolations = manifestResult?.violations || [];

        record.verification = {
          schemaValid: true,
          responsePlausible: outcome.aligned,
          trustScore: Math.min(
            trust.overall,
            manifestViolations.filter((v) => v.severity === "error").length > 0
              ? 50
              : trust.overall
          ),
          verdict:
            manifestViolations.filter((v) => v.severity === "error").length > 0
              ? "SUSPICIOUS"
              : trust.verdict,
          fabricationConfidence: deepConfidence,
          checksPerformed: [
            "invocation",
            "output",
            "fabrication_deep",
            "outcome",
            "manifest_enforcement",
          ],
        };
        record.sessionId = sessionId;

        // Track satisfaction
        satisfaction.trackToolResult(record.id);

        recordCall(record);

        const content =
          result &&
          typeof result === "object" &&
          "content" in result
            ? (result as { content: unknown }).content
            : [{ type: "text" as const, text: JSON.stringify(result, null, 2) }];

        // ─── Verify-my-own-claim: append a self-check proof block ─────
        // Every proxied call returns with its verification inline, so the
        // conversation itself is the receipt. An agent (or human) can pass the
        // call id to tooloftruth_verify to re-confirm against the ledger.
        const proof = [
          "",
          "```proof",
          `verified:  ${record.verification.verdict === "VERIFIED" ? "yes" : "no"}`,
          `call:      ${record.id}`,
          `tool:      ${record.server}__${record.tool}`,
          `verdict:   ${record.verification.verdict}`,
          `trust:     ${record.verification.trustScore}/100`,
          `fabricationConfidence: ${Math.round(record.verification.fabricationConfidence * 100)}%`,
          `duration:  ${record.durationMs}ms`,
          `cost:      $${record.costUsd.toFixed(4)}`,
          `checks:    ${record.verification.checksPerformed.join(", ")}`,
          "verify:    call `tooloftruth_verify` with tool=\"" + tool.originalName + "\" to re-confirm",
          "```",
        ].join("\n");

        const base = Array.isArray(content) ? (content as any[]).slice() : [{ type: "text" as const, text: String(content) }];
        return { content: [...base, { type: "text" as const, text: proof }] };
      }
    );
  }
}

function jsonSchemaToZod(schema: unknown): Record<string, z.ZodTypeAny> {
  if (!schema || typeof schema !== "object") {
    return { _: z.record(z.unknown()) };
  }
  const s = schema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
  if (!s.properties) {
    return { _: z.record(z.unknown()) };
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(s.required || []);

  for (const [key, prop] of Object.entries(s.properties)) {
    let zodType: z.ZodTypeAny;
    switch (prop.type) {
      case "string": zodType = z.string(); break;
      case "number": case "integer": zodType = z.number(); break;
      case "boolean": zodType = z.boolean(); break;
      case "array": zodType = z.array(z.unknown()); break;
      default: zodType = z.unknown(); break;
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    if (!required.has(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }

  return shape;
}

// ─── Start ────────────────────────────────────────────────────

async function main() {
  // Support the plan's one-liner: `npx tooloftruth-mcp <serverName>`
  // Restricts the sentinel to proxy just that downstream server.
  const explicitServer = process.argv[2];

  // Auto-discover downstream servers if proxy.json is empty/missing
  const proxyConfigPath = join(TOOLOFTRUTH_DIR, "proxy.json");
  if (!existsSync(proxyConfigPath) || proxy.getServerNames().length === 0) {
    const discovered = discoverDownstreamServers();
    if (discovered.length > 0) {
      const autoConfig = generateProxyConfig(discovered);
      writeFileSync(proxyConfigPath, JSON.stringify(autoConfig, null, 2));
      // Re-create proxy with auto-discovered config
      const autoProxy = new McpProxy(TOOLOFTRUTH_DIR);
      if (autoProxy.getServerNames().length > 0) {
        await autoProxy.connectAll();
        // Copy tools from auto-proxy to main proxy reference
        for (const tool of autoProxy.getTools()) {
          (proxy as any).tools?.set?.(tool.name, tool);
        }
      }
    }
  }

  const serversToConnect =
    explicitServer && proxy.getServerNames().includes(explicitServer)
      ? [explicitServer]
      : proxy.getServerNames();

  if (serversToConnect.length > 0) {
    await proxy.connectAll(serversToConnect);
    await registerProxyTools();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
