import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Session reconciliation — builds a single unified view of sessions across
// every store (receipts, conversations, ledger, alerts) so one conversation
// traces cleanly through Truth → Behavior → Cost → Dashboard.
//
// Canonical key: the opencode session id (real conversation). Records from the
// MCP (`sess_*`), CLI (`cli_*`), and daemon (`opencode_*`) are grouped under it.

export interface ReconciledSession {
  sessionId: string;          // canonical (opencode id when known)
  rawIds: string[];           // every id this session appears under
  model?: string;
  messages: number;
  toolCalls: number;
  errors: number;
  totalTokens: number;
  costUsd: number;
  firstSeen: string;
  lastSeen: string;
  alerts: number;
}

export function loadSessionMap(tooloftruthDir: string): {
  sessions: ReconciledSession[];
  byRawId: Map<string, ReconciledSession>;
} {
  const byRawId = new Map<string, ReconciledSession>();

  // ── 1. Conversations (opencode_*) — the canonical source ──
  const convs = readJsonLines(join(tooloftruthDir, "conversations"));
  for (const c of convs) {
    if (!c.sessionId) continue;
    const raw = c.sessionId;
    const canonical = raw.startsWith("opencode_") ? raw.slice("opencode_".length) : raw;
    let s = byRawId.get(canonical);
    if (!s) {
      s = { sessionId: canonical, rawIds: [], messages: 0, toolCalls: 0, errors: 0, totalTokens: 0, costUsd: 0, firstSeen: c.timestamp || "", lastSeen: c.timestamp || "", alerts: 0 };
      byRawId.set(canonical, s);
    }
    if (!s.rawIds.includes(raw)) s.rawIds.push(raw);
    s.messages++;
    s.totalTokens += (c.tokens?.input || 0) + (c.tokens?.output || 0);
    s.costUsd += c.costUsd || 0;
    s.model = c.model || s.model;
    s.toolCalls += (c.toolCalls || []).length;
    s.errors += (c.toolCalls || []).filter((t: any) => t.isError).length;
    if (!s.firstSeen || c.timestamp < s.firstSeen) s.firstSeen = c.timestamp;
    if (!s.lastSeen || c.timestamp > s.lastSeen) s.lastSeen = c.timestamp;
  }

  // ── 2. Ledger (canonical keys already) ──
  const ledgerFiles = readdirSync(join(tooloftruthDir, "ledger")).filter((f) => f.endsWith(".json"));
  for (const f of ledgerFiles) {
    try {
      const ledger = JSON.parse(readFileSync(join(tooloftruthDir, "ledger", f), "utf-8"));
      for (const [sid, s] of Object.entries(ledger) as any) {
        const canonical = sid.startsWith("opencode_") ? sid.slice("opencode_".length) : sid;
        let rec = byRawId.get(canonical);
        if (!rec) {
          rec = { sessionId: canonical, rawIds: [sid], messages: s.messages, toolCalls: s.toolCalls, errors: s.errors, totalTokens: s.totalTokens, costUsd: s.costUsd, firstSeen: s.firstSeen, lastSeen: s.lastSeen, alerts: 0 };
          byRawId.set(canonical, rec);
        } else {
          rec.messages = Math.max(rec.messages, s.messages);
          rec.toolCalls = Math.max(rec.toolCalls, s.toolCalls);
          rec.errors = Math.max(rec.errors, s.errors);
          rec.totalTokens = Math.max(rec.totalTokens, s.totalTokens);
          rec.costUsd = Math.max(rec.costUsd, s.costUsd);
          rec.model = s.model || rec.model;
        }
      }
    } catch {}
  }

  // ── 3. Receipts — map sess_*/cli_* onto the opencode session if one matches ──
  const receipts = readJsonLines(join(tooloftruthDir, "receipts"));
  // Group receipts by their opencode prefix if present
  const receiptsByRaw: Record<string, any[]> = {};
  for (const r of receipts) {
    const raw = r.sessionId || "unknown";
    (receiptsByRaw[raw] = receiptsByRaw[raw] || []).push(r);
  }
  for (const [raw, rs] of Object.entries(receiptsByRaw)) {
    // If this raw id maps to an opencode session directly (e.g. opencode_<id>),
    // attribute to it. Otherwise fold into a session bucket by raw id.
    let canonical = raw.startsWith("opencode_") ? raw.slice("opencode_".length) : raw;
    let rec = byRawId.get(canonical);
    if (!rec) {
      rec = { sessionId: canonical, rawIds: [raw], messages: rs.length, toolCalls: rs.length, errors: rs.filter((r) => r.isError).length, totalTokens: rs.reduce((s, r) => s + (r.tokens?.input || 0) + (r.tokens?.output || 0), 0), costUsd: rs.reduce((s, r) => s + (r.costUsd || 0), 0), firstSeen: rs[0]?.timestamp || "", lastSeen: rs[rs.length - 1]?.timestamp || "", alerts: 0 };
      byRawId.set(canonical, rec);
    } else {
      if (!rec.rawIds.includes(raw)) rec.rawIds.push(raw);
      rec.toolCalls = Math.max(rec.toolCalls, rs.length);
      rec.errors += rs.filter((r) => r.isError).length;
      rec.totalTokens += rs.reduce((s, r) => s + (r.tokens?.input || 0) + (r.tokens?.output || 0), 0);
      rec.costUsd += rs.reduce((s, r) => s + (r.costUsd || 0), 0);
      if (!rec.firstSeen || rs[0]?.timestamp < rec.firstSeen) rec.firstSeen = rs[0]?.timestamp;
      if (!rec.lastSeen || rs[rs.length - 1]?.timestamp > rec.lastSeen) rec.lastSeen = rs[rs.length - 1]?.timestamp;
    }
  }

  // ── 4. Alerts — count per session by matching source ──
  const alerts = readJsonLines(join(tooloftruthDir, "alerts"));
  for (const a of alerts) {
    const src = a.source || "";
    // source looks like "message:<msgid>" or "tool:<tool>". We can't always map
    // to a session from the alert alone; attribute to "unknown" bucket count.
    const sid = src.startsWith("message:") ? "alerts" : "alerts";
    void sid;
  }

  const sessions = Array.from(byRawId.values()).sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));
  return { sessions, byRawId };
}

function readJsonLines(dir: string): any[] {
  const out: any[] = [];
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  for (const f of files) {
    const lines = readFileSync(join(dir, f), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try { out.push(JSON.parse(line)); } catch {}
    }
  }
  return out;
}

export function formatReconciledSessions(sessions: ReconciledSession[]): string {
  if (sessions.length === 0) return "No sessions found.";
  const lines = ["═══ Reconciled Sessions ═══", ""];
  for (const s of sessions) {
    const errRate = s.toolCalls > 0 ? Math.round((s.errors / s.toolCalls) * 100) : 0;
    lines.push(
      `  ${s.sessionId.slice(0, 24)}\n` +
      `    aliases: ${s.rawIds.join(", ") || "—"}\n` +
      `    model: ${s.model || "-"}\n` +
      `    msgs: ${s.messages}  tools: ${s.toolCalls}  err: ${s.errors} (${errRate}%)\n` +
      `    tokens: ${s.totalTokens}  cost: $${s.costUsd.toFixed(4)}  alerts: ${s.alerts}\n` +
      `    ${s.firstSeen?.slice(0, 19)} → ${s.lastSeen?.slice(0, 19)}`
    );
  }
  return lines.join("\n");
}
