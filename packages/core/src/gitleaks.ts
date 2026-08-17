import { execSync } from "child_process";
import { existsSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Gitleaks deep-scan integration — runs the gitleaks binary (if installed)
// over a git repo's working tree / commits and returns parsed findings.
// This is the industry-standard secret detector: 200+ regex rules + entropy.

export interface GitleaksFinding {
  RuleID: string;
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  SymlinkFile: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  Fingerprint: string;
}

export interface GitleaksScanResult {
  available: boolean; // is gitleaks installed?
  findings: GitleaksFinding[];
  scannedAt: string;
}

export function gitleaksAvailable(): boolean {
  try {
    execSync("gitleaks version", { stdio: "pipe", timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

export function runGitleaksScan(
  repoPath: string,
  options: { noGit?: boolean } = {}
): GitleaksScanResult {
  if (!gitleaksAvailable()) {
    return { available: false, findings: [], scannedAt: new Date().toISOString() };
  }

  const reportPath = join(mkdtempSync(join(tmpdir(), "gitleaks-")), "report.json");
  const cmd = options.noGit
    ? `gitleaks dir ${repoPath} --no-banner --redact=0 --report-format=json --report-path=${reportPath}`
    : `gitleaks git ${repoPath} --no-banner --redact=0 --report-format=json --report-path=${reportPath}`;

  try {
    execSync(cmd, {
      encoding: "utf-8",
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // gitleaks exits non-zero when it finds leaks; the report file still gets written
  }

  try {
    if (existsSync(reportPath)) {
      const parsed = JSON.parse(readFileSync(reportPath, "utf-8"));
      return {
        available: true,
        findings: Array.isArray(parsed) ? parsed : [],
        scannedAt: new Date().toISOString(),
      };
    }
  } catch {
    // fall through
  }
  return { available: true, findings: [], scannedAt: new Date().toISOString() };
}

export function formatGitleaksFindings(result: GitleaksScanResult): string {
  if (!result.available) return "gitleaks not installed — install with `brew install gitleaks`.";
  if (result.findings.length === 0) return "No secrets found by gitleaks.";
  return result.findings
    .map(
      (f) =>
        `🔴 [${f.RuleID}] ${f.Description || ""}\n` +
        `   file: ${f.File}:${f.StartLine}:${f.StartColumn}\n` +
        `   secret: ${f.Secret.slice(0, 12)}•••${f.Secret.slice(-4)}\n` +
        `   commit: ${(f.Commit || "n/a").slice(0, 12)} by ${f.Author || "?"} (${f.Email || "?"})\n` +
        `   tags: ${(f.Tags || []).join(", ")}`
    )
    .join("\n");
}
