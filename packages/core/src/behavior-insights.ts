import { readAllLedgerSessions } from "./budget.js";
import { readSatisfactionRecords, type SatisfactionRecord } from "./satisfaction.js";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Model behavior insights — aggregate the ledger, receipts, conversations and
// satisfaction records into actionable signal:
//
//  F1  satisfaction correlation  — satisfied/dissatisfied by tool & model
//  F2  retry loops               — consecutive same-tool re-invocations (agent stuck)
//  F3  time-of-day efficiency    — when models slow down / error more
//  F4  prompt-length creep       — input-token growth across a session
//  F5  cross-model quality       — same tool, different models, verdict comparison
//
// Zero network, pure computation over local data.

export interface SessionInsight {
  sessionId: string;
  model?: string;
  messages: number;
  toolCalls: number;
  errors: number;
  errorRate: number; // 0..1
  tokens: number;
  tokensPerCall: number;
  costUsd: number;
  costPerCall: number;
  firstSeen: string;
  lastSeen: string;
  /** True when this session's error rate is above the 12% threshold. */
  errorRegression: boolean;
  /** True when tokens-per-call exceeds the context-bloat threshold. */
  tokenDriftUp: boolean;
  /** True when cost-per-call exceeds the drift threshold. */
  costDriftUp: boolean;
  busy: boolean; // heavy tool usage (tool calls >> messages)
  /** F4: input-token growth across the session (0..1). */
  promptCreep: number;
  /** F2: longest run of consecutive same-tool calls in the session. */
  maxRetryRun: number;
}

export interface ModelProfile {
  model: string;
  sessions: number;
  messages: number;
  toolCalls: number;
  errors: number;
  errorRate: number;
  avgTokensPerCall: number;
  avgCostPerCall: number;
  totalCostUsd: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** F1: satisfaction rate (0..1, null when no data). */
  satisfactionRate: number | null;
  /** F1: dissatisfied tool-call count. */
  dissatisfiedCalls: number;
  /** F3: peak-error hour (0-23) for this model. */
  peakErrorHour: number | null;
  /** F3: average duration in that hour vs overall (slowest hour). */
  slowestHourAvgMs: number | null;
}

export interface ToolSatisfaction {
  tool: string;
  satisfied: number;
  dissatisfied: number;
  unknown: number;
  rate: number | null; // 0..1 satisfied/(satisfied+dissatisfied)
}

export interface RetryLoopInfo {
  sessionId: string;
  tool: string;
  count: number; // consecutive same-tool calls
  window: string; // "start → end"
  detail: string;
}

export interface HourlyEfficiency {
  hour: number; // 0-23
  calls: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
}

export interface CrossModelComparison {
  tool: string;
  models: Array<{
    model: string;
    calls: number;
    errorRate: number;
    avgTrustScore: number;
    fabricationRate: number;
    satisfactionRate: number | null;
  }>;
  spread: number; // trust-score spread across models (0 = no variation)
}

export interface BehaviorInsights {
  generatedAt: string;
  sessions: SessionInsight[];
  byModel: ModelProfile[];
  /** F1: satisfaction by tool. */
  satisfactionByTool: ToolSatisfaction[];
  /** F1: satisfaction by model. */
  satisfactionByModel: Array<{ model: string; rate: number | null; dissatisfied: number; satisfied: number }>;
  /** F2: retry loops (consecutive same-tool runs). */
  retryLoops: RetryLoopInfo[];
  /** F3: hourly efficiency profile. */
  hourly: HourlyEfficiency[];
  /** F5: cross-model quality comparisons. */
  crossModel: CrossModelComparison[];
  /** Aggregate flags worth surfacing to the user. */
  flags: string[];
}

const GRADE_THRESHOLDS: Array<{ max: number; grade: "A" | "B" | "C" | "D" | "F" }> = [
  { max: 0.02, grade: "A" },
  { max: 0.05, grade: "B" },
  { max: 0.10, grade: "C" },
  { max: 0.20, grade: "D" },
  { max: Infinity, grade: "F" },
];

function gradeForErrorRate(rate: number): ModelProfile["grade"] {
  for (const t of GRADE_THRESHOLDS) {
    if (rate <= t.max) return t.grade;
  }
  return "F";
}

// ─── Data loaders ────────────────────────────────────────────

function readJsonLines(dir: string, tooloftruthDir?: string): any[] {
  const full = join(tooloftruthDir || join(homedir(), ".tooloftruth"), dir);
  if (!existsSync(full)) return [];
  const out: any[] = [];
  const files = readdirSync(full).filter((f) => f.endsWith(".jsonl"));
  for (const f of files) {
    const lines = readFileSync(join(full, f), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try { out.push(JSON.parse(line)); } catch { /* skip */ }
    }
  }
  return out;
}

interface ReceiptLike {
  id?: string;
  timestamp?: string;
  tool?: string;
  server?: string;
  sessionId?: string;
  isError?: boolean;
  durationMs?: number;
  costUsd?: number;
  verification?: { verdict?: string; trustScore?: number; fabricationConfidence?: number };
  result?: unknown;
}

interface ConvLike {
  sessionId?: string;
  role?: string;
  type?: string;
  tokens?: { input?: number; output?: number };
  timestamp?: string;
}

// ─── F2: retry loops ─────────────────────────────────────────

export function detectRetryLoops(receipts: ReceiptLike[], minRun = 3): RetryLoopInfo[] {
  const loops: RetryLoopInfo[] = [];
  const bySession = new Map<string, ReceiptLike[]>();
  for (const r of receipts) {
    const sid = r.sessionId || "?";
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(r);
  }
  for (const [sid, calls] of bySession) {
    calls.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    let runStart = 0;
    for (let i = 1; i <= calls.length; i++) {
      const same = i < calls.length && calls[i].tool === calls[i - 1].tool;
      if (!same) {
        const run = calls.slice(runStart, i);
        if (run.length >= minRun && run[0].tool) {
          const tool = run[0].tool!;
          const isError = run.some((r) => r.isError) || run[0].verification?.verdict === "SUSPICIOUS";
          // Only report runs that involve errors/suspicion — consecutive
          // successful calls of a common tool (bash, edit) are normal work.
          if (isError) {
            loops.push({
              sessionId: sid,
              tool,
              count: run.length,
              window: `${run[0].timestamp} → ${run[run.length - 1].timestamp}`,
              detail: `${tool} retried ${run.length}x consecutively with errors — agent may be stuck`,
            });
          }
        }
        runStart = i;
      }
    }
  }
  return loops.sort((a, b) => b.count - a.count);
}

function maxRetryRunForSession(sessionId: string, loops: RetryLoopInfo[]): number {
  const found = loops.filter((l) => l.sessionId === sessionId);
  return found.length > 0 ? Math.max(...found.map((l) => l.count)) : 0;
}

// ─── F4: prompt creep ────────────────────────────────────────

function computePromptCreep(convs: ConvLike[], sessionId: string): number {
  // Match sessions by id with/without opencode_ prefix.
  const canonical = sessionId.startsWith("opencode_") ? sessionId.slice("opencode_".length) : sessionId;
  const msgs = convs
    .filter((c) => (c.sessionId || "").startsWith("opencode_")
      ? (c.sessionId || "").slice("opencode_".length) === canonical
      : c.sessionId === sessionId)
    .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
    .map((c) => c.tokens?.input || 0)
    .filter((t) => t > 0);
  if (msgs.length < 8) return 0; // not enough data
  const half = Math.floor(msgs.length / 2);
  const first = msgs.slice(0, half);
  const second = msgs.slice(half);
  const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / Math.max(1, arr.length);
  const f = avg(first), s = avg(second);
  if (f <= 0) return 0;
  return Math.min(1, (s - f) / f); // 0 = flat, positive = growing, negative = shrinking
}

// ─── F3: time-of-day ─────────────────────────────────────────

function computeHourly(receipts: ReceiptLike[]): HourlyEfficiency[] {
  const buckets = new Map<number, { calls: number; errors: number; durations: number[] }>();
  for (const r of receipts) {
    const ts = r.timestamp;
    if (!ts) continue;
    const h = new Date(ts).getHours();
    if (!buckets.has(h)) buckets.set(h, { calls: 0, errors: 0, durations: [] });
    const b = buckets.get(h)!;
    b.calls++;
    if (r.isError) b.errors++;
    if (typeof r.durationMs === "number") b.durations.push(r.durationMs);
  }
  return Array.from(buckets.entries())
    .map(([hour, b]) => ({
      hour,
      calls: b.calls,
      errors: b.errors,
      errorRate: b.calls > 0 ? Math.round((b.errors / b.calls) * 1000) / 1000 : 0,
      avgDurationMs: b.durations.length > 0 ? Math.round(b.durations.reduce((s, d) => s + d, 0) / b.durations.length) : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

// ─── F5: cross-model ─────────────────────────────────────────

function computeCrossModel(receipts: ReceiptLike[]): CrossModelComparison[] {
  const byTool = new Map<string, Map<string, ReceiptLike[]>>();
  for (const r of receipts) {
    const tool = r.tool || "?";
    const model = r.server || "unknown"; // server = model for proxy
    if (!byTool.has(tool)) byTool.set(tool, new Map());
    const models = byTool.get(tool)!;
    if (!models.has(model)) models.set(model, []);
    models.get(model)!.push(r);
  }
  const out: CrossModelComparison[] = [];
  for (const [tool, models] of byTool) {
    if (models.size < 2) continue; // need ≥2 models to compare
    const rows: CrossModelComparison["models"] = [];
    for (const [model, calls] of models) {
      if (calls.length < 2) continue;
      const errors = calls.filter((c) => c.isError).length;
      const fab = calls.filter((c) => c.verification?.verdict === "FABRICATION").length;
      const trust = calls.reduce((s, c) => s + (c.verification?.trustScore || 0), 0) / calls.length;
      rows.push({
        model,
        calls: calls.length,
        errorRate: calls.length > 0 ? Math.round((errors / calls.length) * 1000) / 1000 : 0,
        avgTrustScore: Math.round(trust * 10) / 10,
        fabricationRate: calls.length > 0 ? Math.round((fab / calls.length) * 1000) / 1000 : 0,
        satisfactionRate: null, // filled below from satisfaction records
      });
    }
    if (rows.length < 2) continue;
    const trustScores = rows.map((r) => r.avgTrustScore);
    const spread = Math.round((Math.max(...trustScores) - Math.min(...trustScores)) * 10) / 10;
    out.push({ tool, models: rows, spread });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

// ─── F1: satisfaction correlation ────────────────────────────

function satisfactionStats(
  records: SatisfactionRecord[],
  by: "tool" | "model",
  key: string
): { satisfied: number; dissatisfied: number; unknown: number; rate: number | null } {
  const rows = records.filter((r) => r[by] === key);
  const satisfied = rows.filter((r) => r.satisfied === true).length;
  const dissatisfied = rows.filter((r) => r.satisfied === false).length;
  const unknown = rows.filter((r) => r.satisfied === null).length;
  const total = satisfied + dissatisfied;
  return { satisfied, dissatisfied, unknown, rate: total > 0 ? satisfied / total : null };
}

// ─── Session insight ─────────────────────────────────────────

function sessionInsight(
  s: Record<string, any>,
  retryLoops: RetryLoopInfo[],
  convs: ConvLike[]
): SessionInsight {
  const toolCalls = s.toolCalls || 0;
  const errors = s.errors || 0;
  const messages = s.messages || 0;
  const tokens = s.totalTokens || 0;
  const cost = s.costUsd || 0;
  const errorRate = toolCalls > 0 ? errors / toolCalls : 0;

  const tokensPerCall = toolCalls > 0 ? tokens / toolCalls : 0;
  const costPerCall = toolCalls > 0 ? cost / toolCalls : 0;

  return {
    sessionId: s.sessionId || "?",
    model: s.model,
    messages,
    toolCalls,
    errors,
    errorRate: Math.round(errorRate * 1000) / 1000,
    tokens,
    tokensPerCall: Math.round(tokensPerCall),
    costUsd: cost,
    costPerCall: Math.round(costPerCall * 100000) / 100000,
    firstSeen: s.firstSeen || "",
    lastSeen: s.lastSeen || "",
    errorRegression: errorRate > 0.12,
    tokenDriftUp: tokensPerCall > 5000,
    costDriftUp: costPerCall > 0.02,
    busy: toolCalls > messages * 1.2 && messages > 0,
    promptCreep: Math.round(computePromptCreep(convs, s.sessionId || "?") * 100) / 100,
    maxRetryRun: maxRetryRunForSession(s.sessionId || "?", retryLoops),
  };
}

export function computeBehaviorInsights(tooloftruthDir?: string): BehaviorInsights {
  const ledger = readAllLedgerSessions(tooloftruthDir);
  const raw = Object.values(ledger).filter((s) => s && typeof s === "object");

  const receipts: ReceiptLike[] = readJsonLines("receipts", tooloftruthDir);
  const convs: ConvLike[] = readJsonLines("conversations", tooloftruthDir);
  const satisfaction = readSatisfactionRecords(tooloftruthDir);

  const retryLoops = detectRetryLoops(receipts);
  const hourly = computeHourly(receipts);
  const crossModel = computeCrossModel(receipts);

  const sessions = raw.map((s) => sessionInsight(s, retryLoops, convs));

  // ── Per-model profiles ──
  const byModelMap = new Map<string, ModelProfile>();
  for (const s of sessions) {
    const model = s.model || "unknown";
    if (!byModelMap.has(model)) {
      byModelMap.set(model, {
        model,
        sessions: 0,
        messages: 0,
        toolCalls: 0,
        errors: 0,
        errorRate: 0,
        avgTokensPerCall: 0,
        avgCostPerCall: 0,
        totalCostUsd: 0,
        grade: "A",
        satisfactionRate: null,
        dissatisfiedCalls: 0,
        peakErrorHour: null,
        slowestHourAvgMs: null,
      });
    }
    const m = byModelMap.get(model)!;
    m.sessions++;
    m.messages += s.messages;
    m.toolCalls += s.toolCalls;
    m.errors += s.errors;
    m.totalCostUsd += s.costUsd;
  }
  for (const m of byModelMap.values()) {
    m.errorRate = m.toolCalls > 0 ? m.errors / m.toolCalls : 0;
    m.avgTokensPerCall = m.toolCalls > 0 ? Math.round(((m.messages * 1500) || 0) / m.toolCalls) : 0;
    m.avgCostPerCall = m.toolCalls > 0 ? m.totalCostUsd / m.toolCalls : 0;
    m.grade = gradeForErrorRate(m.errorRate);

    // F1: satisfaction per model
    const sat = satisfactionStats(satisfaction, "model", m.model);
    m.satisfactionRate = sat.rate;
    m.dissatisfiedCalls = sat.dissatisfied;

    // F3: model's peak-error + slowest hour (from hourly, which is tool-level;
    // we approximate model-level using server field on receipts).
    const modelReceipts = receipts.filter((r) => (r.server || "") === m.model);
    const modelHourly = computeHourly(modelReceipts);
    const byErr = [...modelHourly].sort((a, b) => b.errorRate - a.errorRate || b.avgDurationMs - a.avgDurationMs);
    if (byErr.length > 0) m.peakErrorHour = byErr[0].hour;
    const byDur = [...modelHourly].sort((a, b) => b.avgDurationMs - a.avgDurationMs);
    if (byDur.length > 0) m.slowestHourAvgMs = byDur[0].avgDurationMs;
  }
  const byModel = Array.from(byModelMap.values()).sort((a, b) => b.toolCalls - a.toolCalls);

  // ── F1: satisfaction by tool ──
  const toolSats = new Map<string, ToolSatisfaction>();
  for (const r of satisfaction) {
    const t = r.tool || "?";
    if (!toolSats.has(t)) toolSats.set(t, { tool: t, satisfied: 0, dissatisfied: 0, unknown: 0, rate: null });
    const s = toolSats.get(t)!;
    if (r.satisfied === true) s.satisfied++;
    else if (r.satisfied === false) s.dissatisfied++;
    else s.unknown++;
  }
  const satisfactionByTool = Array.from(toolSats.values()).map((s) => {
    const total = s.satisfied + s.dissatisfied;
    s.rate = total > 0 ? s.satisfied / total : null;
    return s;
  }).sort((a, b) => (b.dissatisfied + b.satisfied) - (a.dissatisfied + a.satisfied));

  const satisfactionByModel = byModel.map((m) => ({
    model: m.model,
    rate: m.satisfactionRate,
    satisfied: satisfaction.filter((r) => r.model === m.model && r.satisfied === true).length,
    dissatisfied: m.dissatisfiedCalls,
  }));

  // ── F5: fill satisfaction into cross-model rows ──
  for (const cmp of crossModel) {
    for (const row of cmp.models) {
      const stats = satisfactionStats(satisfaction, "tool", cmp.tool);
      // Model-specific: match by server
      const modelRecs = satisfaction.filter((r) => r.tool === cmp.tool && r.server === row.model);
      const sat = modelRecs.filter((r) => r.satisfied === true).length;
      const dis = modelRecs.filter((r) => r.satisfied === false).length;
      row.satisfactionRate = sat + dis > 0 ? sat / (sat + dis) : (stats.rate ?? null);
    }
  }

  // ── Flags ──
  const flags: string[] = [];
  for (const s of sessions) {
    if (s.errorRegression) flags.push(`Session ${s.sessionId.slice(-12)} error rate ${Math.round(s.errorRate * 100)}% (above 12%)`);
    if (s.tokenDriftUp) flags.push(`Session ${s.sessionId.slice(-12)} averaging ${s.tokensPerCall} tokens/call (context bloat)`);
    if (s.costDriftUp) flags.push(`Session ${s.sessionId.slice(-12)} costing ${(s.costPerCall * 100).toFixed(2)}¢/call`);
    if (s.busy) flags.push(`Session ${s.sessionId.slice(-12)} is tool-heavy (${s.toolCalls} tools vs ${s.messages} msgs)`);
    if (s.promptCreep > 0.5) flags.push(`Session ${s.sessionId.slice(-12)} input tokens grew ${Math.round(s.promptCreep * 100)}% across the session (prompt creep)`);
    if (s.maxRetryRun >= 4) flags.push(`Session ${s.sessionId.slice(-12)} retried same tool ${s.maxRetryRun}x consecutively — agent may be stuck`);
  }
  for (const l of retryLoops) {
    if (l.count >= 4) flags.push(l.detail);
  }
  for (const s of satisfactionByTool) {
    if (s.dissatisfied >= 2 && s.rate !== null && s.rate < 0.5) {
      flags.push(`Tool ${s.tool}: ${s.dissatisfied}/${s.dissatisfied + s.satisfied} outcomes dissatisfied`);
    }
  }
  for (const m of byModel) {
    if (m.grade === "D" || m.grade === "F") {
      flags.push(`Model ${m.model} grade ${m.grade} — ${Math.round(m.errorRate * 100)}% error rate across ${m.sessions} session(s)`);
    }
    if (m.dissatisfiedCalls >= 2 && m.satisfactionRate !== null && m.satisfactionRate < 0.5) {
      flags.push(`Model ${m.model} — ${m.dissatisfiedCalls} dissatisfied outcome(s)`);
    }
  }
  for (const cmp of crossModel) {
    if (cmp.spread > 20) {
      const worst = cmp.models.reduce((a, b) => (b.avgTrustScore < a.avgTrustScore ? b : a));
      flags.push(`Tool ${cmp.tool} trust-score spread ${cmp.spread} pts — worst model: ${worst.model} (${worst.avgTrustScore}/100)`);
    }
  }
  for (const h of hourly) {
    if (h.calls >= 5 && h.errorRate > 0.25) {
      flags.push(`Hour ${String(h.hour).padStart(2, "0")}:00 shows ${Math.round(h.errorRate * 100)}% error rate (${h.calls} calls)`);
    }
  }
  if (flags.length === 0) flags.push("No behavioral regressions detected.");

  return {
    generatedAt: new Date().toISOString(),
    sessions,
    byModel,
    satisfactionByTool,
    satisfactionByModel,
    retryLoops,
    hourly,
    crossModel,
    flags,
  };
}

export function formatBehaviorInsights(insights: BehaviorInsights): string {
  const lines = ["═══ Model Behavior Insights ═══", ""];

  lines.push("Models:");
  for (const m of insights.byModel) {
    const sat = m.satisfactionRate === null ? "n/a" : `${Math.round(m.satisfactionRate * 100)}% sat`;
    lines.push(
      `  [${m.grade}] ${m.model}` +
      `  ${m.sessions} sess · ${m.toolCalls} calls · ${Math.round(m.errorRate * 100)}% err` +
      ` · ${m.avgTokensPerCall} tok/call · $${m.avgCostPerCall.toFixed(4)}/call · ${sat}`
    );
    if (m.peakErrorHour !== null) {
      lines.push(`      peak error hour: ${String(m.peakErrorHour).padStart(2, "0")}:00 (avg ${m.slowestHourAvgMs}ms)`);
    }
  }

  if (insights.satisfactionByTool.length > 0) {
    lines.push("", "Satisfaction by tool:");
    for (const t of insights.satisfactionByTool) {
      const rate = t.rate === null ? "n/a" : `${Math.round(t.rate * 100)}%`;
      lines.push(`  ${t.tool}  ${t.satisfied}👍 / ${t.dissatisfied}👎 / ${t.unknown}?  (${rate} satisfied)`);
    }
  }

  if (insights.retryLoops.length > 0) {
    lines.push("", "Retry loops:");
    for (const l of insights.retryLoops.slice(0, 10)) {
      lines.push(`  ${l.tool} × ${l.count} (${l.sessionId.slice(-12)})`);
    }
  }

  if (insights.crossModel.length > 0) {
    lines.push("", "Cross-model quality:");
    for (const c of insights.crossModel.slice(0, 10)) {
      lines.push(`  ${c.tool} (spread ${c.spread} pts):`);
      for (const m of c.models) {
        lines.push(`    ${m.model}  trust ${m.avgTrustScore}/100 · ${Math.round(m.errorRate * 100)}% err · ${m.fabricationRate > 0 ? `${Math.round(m.fabricationRate * 100)}% fab` : "no fab"}`);
      }
    }
  }

  if (insights.hourly.length > 0) {
    lines.push("", "Hourly profile:");
    for (const h of insights.hourly) {
      lines.push(`  ${String(h.hour).padStart(2, "0")}:00  ${h.calls} calls · ${Math.round(h.errorRate * 100)}% err · ${h.avgDurationMs}ms avg`);
    }
  }

  lines.push("", "Flags:");
  for (const f of insights.flags) lines.push(`  ⚠ ${f}`);
  return lines.join("\n");
}
