#!/usr/bin/env node
import { createServer } from "http";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { DASHBOARD_HTML } from "./dashboard-html.js";

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

export function startDashboardServer(port: number = PORT): void {
  const server = createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (url === "/api/data") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(apiData()));
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
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ""));
if (isMain || process.env.TOOLOFTRUTH_START_DASHBOARD === "1") {
  startDashboardServer(PORT);
}
