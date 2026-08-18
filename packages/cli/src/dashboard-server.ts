#!/usr/bin/env node
import { createServer } from "http";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { DASHBOARD_HTML } from "./dashboard-html.js";
import { loadSessionMap, loadAlertConfig, updateAlertConfig, formatAlertConfig, computeBudgetStatus, setBudgetLimit, setBudgetAction, formatBudgetStatus } from "@tooloftruth/core";

// Tool of Truth — local dashboard server (folded into CLI package)
// Reads ~/.tooloftruth/* and serves a single-file, zero-dep dashboard.

const TOOLOFTRUTH_DIR = process.env.TOOLOFTRUTH_DIR || join(homedir(), ".tooloftruth");
const PORT = Number(process.env.TOOLOFTRUTH_PORT || 4321);

function readJsonLines(dir: string): any[] {
  const out: any[] = [];
  const full = join(TOOLOFTRUTH_DIR, dir);
  if (!existsSync(full)) return out;
  const files = readdirSync(full).filter((f) => f.endsWith(".jsonl"));
  for (const f of files) {
    const lines = readFileSync(join(full, f), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try { out.push(JSON.parse(line)); } catch {}
    }
  }
  return out;
}

function readJsonFiles(dir: string): any[] {
  const out: any[] = [];
  const full = join(TOOLOFTRUTH_DIR, dir);
  if (!existsSync(full)) return out;
  const files = readdirSync(full).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(full, f), "utf-8"));
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {}
  }
  return out;
}

function readFileOrNull(rel: string): string | null {
  const full = join(TOOLOFTRUTH_DIR, rel);
  if (!existsSync(full)) return null;
  try { return readFileSync(full, "utf-8"); } catch { return null; }
}

interface ReportData {
  scope: "session" | "day" | "all";
  title: string;
  generatedAt: string;
  totals: {
    calls: number;
    costUsd: number;
    tokens: { input: number; output: number };
    alerts: number;
    fabrications: number;
    suspicious: number;
    verified: number;
  };
  sessions: any[];
  byTool: Record<string, { calls: number; costUsd: number; errors: number }>;
  alerts: any[];
  recentCalls: any[];
}

function buildReport(data: any, scope: "session" | "day" | "all", id: string, date: string): ReportData {
  let receipts = data.receipts || [];
  let alerts = data.alerts || [];
  let title = "Full activity";
  const sessions: any[] = [];

  if (scope === "session" && id) {
    const canonical = id.startsWith("opencode_") ? id.slice("opencode_".length) : id;
    const matches = (sid: string) => {
      const s = (sid || "").startsWith("opencode_") ? sid.slice("opencode_".length) : sid;
      return s === canonical || sid === id;
    };
    receipts = receipts.filter((r: any) => matches(r.sessionId));
    alerts = alerts.filter((a: any) => matches(a.sessionId) || matches(a.source));
    const sess = data.ledger[canonical] || data.ledger[`opencode_${canonical}`] || null;
    if (sess) sessions.push(sess);
    title = `Session ${canonical.slice(-12)}`;
  } else if (scope === "day" && date) {
    receipts = receipts.filter((r: any) => (r.timestamp || "").slice(0, 10) === date);
    alerts = alerts.filter((a: any) => (a.timestamp || "").slice(0, 10) === date);
    sessions.push(...Object.values(data.ledger || {}).filter((s: any) => (s.lastSeen || "").slice(0, 10) === date));
    title = `Day ${date}`;
  } else if (scope === "day") {
    const today = new Date().toISOString().slice(0, 10);
    return buildReport(data, "day", id, today);
  }

  const verified = receipts.filter((r: any) => r.verification?.verdict === "VERIFIED").length;
  const suspicious = receipts.filter((r: any) => r.verification?.verdict === "SUSPICIOUS").length;
  const fabrications = receipts.filter((r: any) => r.verification?.verdict === "FABRICATION").length;

  const byTool: ReportData["byTool"] = {};
  for (const r of receipts) {
    const t = r.tool || "?";
    byTool[t] = byTool[t] || { calls: 0, costUsd: 0, errors: 0 };
    byTool[t].calls++;
    byTool[t].costUsd += r.costUsd || 0;
    if (r.isError) byTool[t].errors++;
  }

  return {
    scope,
    title,
    generatedAt: new Date().toISOString(),
    totals: {
      calls: receipts.length,
      costUsd: receipts.reduce((s: number, r: any) => s + (r.costUsd || 0), 0),
      tokens: receipts.reduce(
        (s: { input: number; output: number }, r: any) => ({ input: s.input + (r.tokens?.input || 0), output: s.output + (r.tokens?.output || 0) }),
        { input: 0, output: 0 }
      ),
      alerts: alerts.length,
      fabrications,
      suspicious,
      verified,
    },
    sessions,
    byTool,
    alerts: alerts.slice(0, 200),
    recentCalls: receipts.slice(-100).map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      tool: r.tool,
      server: r.server,
      sessionId: r.sessionId,
      durationMs: r.durationMs,
      isError: r.isError,
      costUsd: r.costUsd,
      verdict: r.verification?.verdict,
      trustScore: r.verification?.trustScore,
    })),
  };
}

function renderReportHtml(r: ReportData): string {
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const money = (n: number) => "$" + (n || 0).toFixed(4);
  const byToolRows = Object.entries(r.byTool).sort((a, b) => b[1].costUsd - a[1].costUsd).map(
    ([tool, t]) => `<tr><td>${esc(tool)}</td><td>${t.calls}</td><td>${money(t.costUsd)}</td><td>${t.errors}</td></tr>`
  ).join("");
  const alertRows = r.alerts.map((a: any) =>
    `<tr><td>${esc(a.timestamp)}</td><td><b>${esc(a.severity)}</b></td><td>${esc(a.category)}</td><td>${esc(a.rule)}</td><td>${esc(a.matchRedacted)}</td><td>${esc(a.source)}</td></tr>`
  ).join("");
  const callRows = r.recentCalls.map((c: any) =>
    `<tr><td>${esc(c.timestamp)}</td><td>${esc(c.tool)}</td><td>${esc(c.server)}</td><td>${esc(c.verdict)}</td><td>${c.trustScore}</td><td>${esc(c.isError ? "ERR" : "ok")}</td><td>${money(c.costUsd)}</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.title)} — Tool of Truth</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0A0A0A;color:#F6F4EF;margin:0;padding:2rem;line-height:1.5}header{border-bottom:1px solid rgba(246,244,239,.15);padding-bottom:1rem;margin-bottom:2rem}h1{font-size:1.4rem;margin:0 0 .3rem;letter-spacing:.04em}sub{color:rgba(246,244,239,.55)}h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.12em;color:#C9A227;margin-top:2.5rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:rgba(246,244,239,.12);border:1px solid rgba(246,244,239,.12);margin:1rem 0}.cell{background:#141414;padding:1rem}.cell b{font-size:1.3rem;display:block}table{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.5rem}th{text-align:left;color:rgba(246,244,239,.55);text-transform:uppercase;font-size:.62rem;letter-spacing:.08em;padding:.5rem;border-bottom:1px solid rgba(246,244,239,.12)}td{padding:.45rem .5rem;border-bottom:1px solid rgba(246,244,239,.06);font-family:ui-monospace,Menlo,monospace;font-size:.72rem;word-break:break-all}@media print{body{background:#fff;color:#111}header{border-color:#ccc}.grid{background:#ddd;border-color:#ccc}.cell{background:#f5f5f5}th{border-color:#ccc;color:#555}td{border-color:#eee}}</style></head>
<body><header><h1>${esc(r.title)} — Tool of Truth report</h1><sub>generated ${esc(r.generatedAt)} · ${r.totals.calls} calls · ${r.totals.alerts} alerts</sub></header>
<div class="grid">
<div class="cell"><b>${r.totals.calls}</b>calls</div>
<div class="cell"><b>${money(r.totals.costUsd)}</b>cost</div>
<div class="cell"><b>${r.totals.tokens.input + r.totals.tokens.output}</b>tokens</div>
<div class="cell"><b style="color:#10B981">${r.totals.verified}</b>verified</div>
<div class="cell"><b style="color:#C9A227">${r.totals.suspicious}</b>suspicious</div>
<div class="cell"><b style="color:#EF4444">${r.totals.fabrications}</b>fabrications</div>
<div class="cell"><b style="color:#EF4444">${r.totals.alerts}</b>alerts</div>
</div>
<h2>Sessions</h2><table><thead><tr><th>id</th><th>model</th><th>msgs</th><th>calls</th><th>errors</th><th>tokens</th><th>cost</th></tr></thead><tbody>
${r.sessions.map((s: any) => `<tr><td>${esc(s.sessionId)}</td><td>${esc(s.model || "—")}</td><td>${s.messages}</td><td>${s.toolCalls}</td><td>${s.errors}</td><td>${s.totalTokens}</td><td>${money(s.costUsd)}</td></tr>`).join("")}
</tbody></table>
<h2>By tool</h2><table><thead><tr><th>tool</th><th>calls</th><th>cost</th><th>errors</th></tr></thead><tbody>${byToolRows || `<tr><td colspan="4">none</td></tr>`}</tbody></table>
<h2>Alerts</h2><table><thead><tr><th>time</th><th>severity</th><th>category</th><th>rule</th><th>match</th><th>source</th></tr></thead><tbody>${alertRows || `<tr><td colspan="6">none</td></tr>`}</tbody></table>
<h2>Recent calls</h2><table><thead><tr><th>time</th><th>tool</th><th>server</th><th>verdict</th><th>trust</th><th>status</th><th>cost</th></tr></thead><tbody>${callRows || `<tr><td colspan="7">none</td></tr>`}</tbody></table>
</body></html>`;
}

function apiData(): any {
  const receipts = readJsonLines("receipts");
  const alerts = readJsonLines("alerts");
  const conversations = readJsonLines("conversations");
  const satisfaction = readJsonLines("satisfaction");
  const stats = readJsonFiles("stats");
  const ledgerFiles = readdirSync(join(TOOLOFTRUTH_DIR, "ledger")).filter((f) => f.endsWith(".json"));
  let ledger: any = {};
  try {
    if (ledgerFiles.length > 0) {
      ledger = JSON.parse(readFileSync(join(TOOLOFTRUTH_DIR, "ledger", ledgerFiles[0]), "utf-8"));
    }
  } catch {}

  return {
    receipts,
    alerts,
    conversations,
    satisfaction,
    stats,
    ledger,
    sessions: loadSessionMap(TOOLOFTRUTH_DIR).sessions,
    index: readFileOrNull("index.json") ? JSON.parse(readFileOrNull("index.json")!) : null,
    proxy: readFileOrNull("proxy.json") ? JSON.parse(readFileOrNull("proxy.json")!) : null,
    latestAlert: readFileOrNull("alerts/latest-alert.txt"),
    budget: computeBudgetStatus(TOOLOFTRUTH_DIR),
  };
}

export function startDashboardServer(port: number = PORT): void {
const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // ─── Alert config: GET (view) / POST (update) ─────────────
  if (url === "/api/alerts-config") {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const updated = updateAlertConfig(input, TOOLOFTRUTH_DIR);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(updated));
        } catch {
          res.writeHead(400); res.end(JSON.stringify({ error: "invalid body" }));
        }
      });
      return;
    }
    const cfg = loadAlertConfig(TOOLOFTRUTH_DIR);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cfg));
    return;
  }

  if (url === "/api/data") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(apiData()));
      return;
    }

    if (url === "/api/session") {
      // ?id=<sessionId> → return every record for that session across stores
      const id = decodeURIComponent((req.url || "").split("=")[1] || "");
      const data = apiData();
      const canonical = id.startsWith("opencode_") ? id.slice("opencode_".length) : id;
      const convs = data.conversations.filter((c: any) => {
        const sid = (c.sessionId || "").startsWith("opencode_") ? c.sessionId.slice("opencode_".length) : c.sessionId;
        return sid === canonical || c.sessionId === id;
      });
      const receipts = data.receipts.filter((r: any) => r.sessionId === id || r.sessionId === `opencode_${canonical}`);
      const ledger = data.ledger[canonical] || data.ledger[`opencode_${canonical}`] || null;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessionId: id, conversations: convs, receipts, ledger }));
      return;
    }

    if (url === "/api/gitleaks") {
      const repoPath = decodeURIComponent((req.url || "").split("=")[1] || "");
      if (!repoPath) { res.writeHead(400); res.end(JSON.stringify({ error: "repoPath required" })); return; }
      const reportPath = `/tmp/gitleaks-dash-${process.pid}.json`;
      try {
        execSync(`gitleaks git "${repoPath}" --no-banner --redact=0 --report-format=json --report-path=${reportPath}`, { encoding: "utf-8", timeout: 60000, stdio: ["pipe","pipe","pipe"] });
      } catch {
        // gitleaks exits non-zero on findings; report still written
      }
      try {
        const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf-8")) : [];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ findings: Array.isArray(report) ? report : [] }));
      } catch {
        res.writeHead(500); res.end(JSON.stringify({ error: "gitleaks failed" }));
      }
      return;
    }

    if (url === "/api/budget") {
      // GET → status; POST {dailyLimitUsd} | {action} → set
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const input = JSON.parse(body || "{}");
            if (input.dailyLimitUsd !== undefined) setBudgetLimit(Number(input.dailyLimitUsd), TOOLOFTRUTH_DIR);
            if (input.action) setBudgetAction(input.action as "alert" | "warn", TOOLOFTRUTH_DIR);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: computeBudgetStatus(TOOLOFTRUTH_DIR), text: formatBudgetStatus(computeBudgetStatus(TOOLOFTRUTH_DIR)) }));
          } catch {
            res.writeHead(400); res.end(JSON.stringify({ error: "invalid body" }));
          }
        });
        return;
      }
      const status = computeBudgetStatus(TOOLOFTRUTH_DIR);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status, text: formatBudgetStatus(status) }));
      return;
    }

    if (url === "/api/export") {
      // ?scope=session&id=<sessionId> | ?scope=day&date=YYYY-MM-DD | ?scope=all
      // Returns a JSON report (or HTML with &format=html).
      const qs = new URLSearchParams((req.url || "").split("?")[1] || "");
      const scopeParam = qs.get("scope") || "day";
      const scope: "session" | "day" | "all" =
        scopeParam === "session" || scopeParam === "all" ? scopeParam : "day";
      const id = qs.get("id") || "";
      const date = qs.get("date") || "";
      const format = qs.get("format") || "json";
      const data = apiData();
      const report = buildReport(data, scope, id, date);
      if (format === "html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderReportHtml(report));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(report, null, 2));
      }
      return;
    }

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(DASHBOARD_HTML);
      return;
    }

    if (url === "/favicon.ico") {
      // Inline SVG favicon (brand needle)
      const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0A0A0A" stroke="#F6F4EF"/><line x1="12" y1="12" x2="16" y2="6" stroke="#10B981" stroke-width="2"/></svg>`;
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(favicon);
      return;
    }

    res.writeHead(404); res.end("not found");
  });

  server.listen(port, "127.0.0.1", () => {
    console.error(`[tooloftruth:dashboard] http://localhost:${port}`);
  });
}

// Direct execution: `node server.js` or `tooloftruth dashboard`
const isMain =
  (process.argv[1] && /dashboard-server(\.js)?$/.test(process.argv[1])) ||
  process.env.TOOLOFTRUTH_START_DASHBOARD === "1";
if (isMain) {
  startDashboardServer(PORT);
}
