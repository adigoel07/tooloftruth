import type { TruthScanResult, ClaimAnalysis, Source } from "./truth-scan.js";

const SCORE_ICONS: Record<string, string> = {
  VERIFIED: "✅",
  MOSTLY_TRUE: "🟢",
  MIXED: "🟡",
  UNVERIFIABLE: "⚪",
  MOSTLY_FALSE: "🟠",
  FALSE: "🔴",
};

const CLAIM_ICONS: Record<string, string> = {
  supported: "✓",
  unsupported: "✗",
  contradicted: "⊘",
  unverifiable: "?",
};

function scoreBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function formatClaimAnalysis(claim: ClaimAnalysis, index: number): string {
  const icon = CLAIM_ICONS[claim.verdict] || "?";
  const lines = [
    `  ${icon} Claim ${index + 1}: "${claim.claim}"`,
    `    Score: ${scoreBar(claim.score)} ${claim.score}/100`,
    `    Verdict: ${claim.verdict.toUpperCase()}`,
  ];

  if (claim.evidence.length > 0) {
    lines.push(`    Evidence:`);
    for (const e of claim.evidence.slice(0, 3)) {
      lines.push(`      • ${e}`);
    }
  }

  if (claim.reasoning) {
    lines.push(`    Reasoning: ${claim.reasoning}`);
  }

  return lines.join("\n");
}

function formatSource(source: Source, index: number): string {
  const reliability = source.reliability >= 0.7 ? "●" : source.reliability >= 0.4 ? "◐" : "○";
  return `  ${reliability} ${index + 1}. ${source.title || source.url}\n     ${source.url}\n     ${source.snippet.slice(0, 120)}...`;
}

export function formatTruthScanResult(result: TruthScanResult): string {
  const icon = SCORE_ICONS[result.verdict] || "⚪";
  const lines = [
    "",
    "┄".repeat(56),
    "              ◆ TOOL OF TRUTH — TRUTH SCAN ◆",
    "┄".repeat(56),
    "",
    `  Input type: ${result.inputType}`,
    `  Overall score: ${scoreBar(result.overallScore)} ${result.overallScore}/100`,
    `  Verdict: ${icon} ${result.verdict.replace(/_/g, " ")}`,
    `  Confidence: ${result.confidence}%`,
    "",
    "┄".repeat(56),
    "  CLAIMS ANALYSIS",
    "┄".repeat(56),
    "",
  ];

  for (let i = 0; i < result.claims.length; i++) {
    lines.push(formatClaimAnalysis(result.claims[i], i));
    lines.push("");
  }

  if (result.sources.length > 0) {
    lines.push("┄".repeat(56));
    lines.push("  SOURCES");
    lines.push("┄".repeat(56));
    lines.push("");
    for (let i = 0; i < result.sources.length; i++) {
      lines.push(formatSource(result.sources[i], i));
      lines.push("");
    }
  }

  if (result.suggestions.length > 0) {
    lines.push("┄".repeat(56));
    lines.push("  SUGGESTIONS");
    lines.push("┄".repeat(56));
    lines.push("");
    for (const s of result.suggestions) {
      lines.push(`  → ${s}`);
    }
    lines.push("");
  }

  lines.push("┄".repeat(56));
  lines.push(`  Methodology: ${result.methodology}`);
  lines.push("┄".repeat(56));
  lines.push("");

  return lines.join("\n");
}
