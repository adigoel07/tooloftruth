#!/usr/bin/env node
import { createServer } from "http";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

// Tool of Truth — local dashboard server
// Reads ~/.tooloftruth/* and serves a single-file, zero-dep dashboard.

const TOOLOFTRUTH_DIR = process.env.TOOLOFTRUTH_DIR || join(homedir(), ".tooloftruth");
const PORT = Number(process.env.TOOLOFTRUTH_PORT || 4321);

function readJsonLines(dir: string, filePrefix = ""): any[] {
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

function apiData(): any {
  const receipts = readJsonLines("receipts");
  const alerts = readJsonLines("alerts");
  const conversations = readJsonLines("conversations");
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
    stats,
    ledger,
    index: readFileOrNull("index.json") ? JSON.parse(readFileOrNull("index.json")!) : null,
    proxy: readFileOrNull("proxy.json") ? JSON.parse(readFileOrNull("proxy.json")!) : null,
    latestAlert: readFileOrNull("alerts/latest-alert.txt"),
  };
}

const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // ─── JSON API ───────────────────────────────────────────────
  if (url === "/api/data") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(apiData()));
    return;
  }

  if (url === "/api/gitleaks") {
    const repoPath = decodeURIComponent((req.url || "").split("=")[1] || "");
    if (!repoPath) { res.writeHead(400); res.end(JSON.stringify({ error: "repoPath required" })); return; }
    try {
      const output = execSync(`gitleaks git "${repoPath}" --no-banner --redact=0 --report-format=json --report-path=/tmp/gitleaks-dash-report.json`, { encoding: "utf-8", timeout: 60000, stdio: ["pipe","pipe","pipe"] });
      const report = existsSync("/tmp/gitleaks-dash-report.json") ? JSON.parse(readFileSync("/tmp/gitleaks-dash-report.json","utf-8")) : [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ findings: Array.isArray(report) ? report : [] }));
    } catch (e: any) {
      // gitleaks exits non-zero on leaks; report still written
      try {
        const report = existsSync("/tmp/gitleaks-dash-report.json") ? JSON.parse(readFileSync("/tmp/gitleaks-dash-report.json","utf-8")) : [];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ findings: Array.isArray(report) ? report : [] }));
      } catch {
        res.writeHead(500); res.end(JSON.stringify({ error: "gitleaks failed" }));
      }
    }
    return;
  }

  // ─── Serve the dashboard (single HTML) ──────────────────────
  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(DASHBOARD_HTML);
    return;
  }

  res.writeHead(404); res.end("not found");
});

// The dashboard is inlined from a separate file at build time.
let DASHBOARD_HTML = "";
try {
  const dashPath = join(import.meta.dirname ?? __dirname, "..", "src", "dashboard.html");
  DASHBOARD_HTML = readFileSync(dashPath, "utf-8");
} catch {
  DASHBOARD_HTML = "<h1>Dashboard not found — rebuild package</h1>";
}

server.listen(PORT, "127.0.0.1", () => {
  console.error(`[tooloftruth:dashboard] http://localhost:${PORT}`);
});
