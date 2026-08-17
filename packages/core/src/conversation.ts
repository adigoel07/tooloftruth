import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface ConversationEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  type: "claim" | "action" | "result" | "observation";
  content: string;
  toolMentioned?: string;
  claimedUsage?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ClaimVerification {
  claimId: string;
  toolClaimed: string;
  claimedAt: string;
  verified: boolean;
  actualCallsFound: number;
  verdict: "VERIFIED" | "FABRICATED" | "UNVERIFIABLE";
  details: string;
}

export class ConversationLogger {
  private baseDir: string;
  private sessionId: string;

  constructor(baseDir: string, sessionId: string) {
    this.baseDir = join(baseDir, "conversations");
    this.sessionId = sessionId;
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  log(entry: Omit<ConversationEntry, "id" | "timestamp" | "sessionId">): ConversationEntry {
    const full: ConversationEntry = {
      id: `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...entry,
    };

    const date = full.timestamp.slice(0, 10);
    const filePath = join(this.baseDir, `${date}.jsonl`);
    appendFileSync(filePath, JSON.stringify(full) + "\n");
    return full;
  }

  logClaim(toolName: string, context: string): ConversationEntry {
    return this.log({
      type: "claim",
      content: context,
      toolMentioned: toolName,
      claimedUsage: true,
    });
  }

  logAction(action: string): ConversationEntry {
    return this.log({
      type: "action",
      content: action,
    });
  }

  logResult(result: string): ConversationEntry {
    return this.log({
      type: "result",
      content: result,
    });
  }

  logObservation(observation: string): ConversationEntry {
    return this.log({
      type: "observation",
      content: observation,
    });
  }

  getEntries(date?: string): ConversationEntry[] {
    const entries: ConversationEntry[] = [];

    if (date) {
      const filePath = join(this.baseDir, `${date}.jsonl`);
      if (existsSync(filePath)) {
        entries.push(...this.parseFile(filePath));
      }
    } else {
      const files = readdirSync(this.baseDir)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .reverse()
        .slice(0, 7); // last 7 days

      for (const file of files) {
        entries.push(...this.parseFile(join(this.baseDir, file)));
      }
    }

    return entries;
  }

  getClaims(date?: string): ConversationEntry[] {
    return this.getEntries(date).filter((e) => e.type === "claim");
  }

  getClaimsForTool(toolName: string, date?: string): ConversationEntry[] {
    return this.getClaims(date).filter((e) => e.toolMentioned === toolName);
  }

  private parseFile(path: string): ConversationEntry[] {
    try {
      const content = readFileSync(path, "utf-8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ConversationEntry);
    } catch {
      return [];
    }
  }
}

export function crossReferenceClaims(
  claims: ConversationEntry[],
  toolCalls: Array<{ tool: string; server: string; timestamp: string }>
): ClaimVerification[] {
  const results: ClaimVerification[] = [];

  for (const claim of claims) {
    if (!claim.toolMentioned) continue;

    const matchingCalls = toolCalls.filter(
      (c) =>
        c.tool === claim.toolMentioned ||
        c.server === claim.toolMentioned ||
        `${c.server}__${c.tool}` === claim.toolMentioned
    );

    // Check if any call happened around the same time as the claim
    const claimTime = new Date(claim.timestamp).getTime();
    const nearbyCalls = matchingCalls.filter((c) => {
      const callTime = new Date(c.timestamp).getTime();
      return Math.abs(callTime - claimTime) < 300000; // within 5 minutes
    });

    const verified = matchingCalls.length > 0;
    const verdict: ClaimVerification["verdict"] = verified
      ? "VERIFIED"
      : matchingCalls.length === 0 && claim.claimedUsage
        ? "FABRICATED"
        : "UNVERIFIABLE";

    results.push({
      claimId: claim.id,
      toolClaimed: claim.toolMentioned,
      claimedAt: claim.timestamp,
      verified,
      actualCallsFound: matchingCalls.length,
      verdict,
      details: verified
        ? `Found ${matchingCalls.length} matching call(s) in tool log`
        : `Agent claimed to use '${claim.toolMentioned}' but no matching tool call found`,
    });
  }

  return results;
}

export function formatClaimVerifications(results: ClaimVerification[]): string {
  if (results.length === 0) return "No tool claims to verify.";

  const lines = [
    "═══ Claim Verification Report ═══",
    "",
  ];

  let verified = 0;
  let fabricated = 0;
  let unverifiable = 0;

  for (const r of results) {
    const icon =
      r.verdict === "VERIFIED" ? "✓" : r.verdict === "FABRICATED" ? "✗" : "?";
    const detail = r.verified
      ? `${r.actualCallsFound} matching calls found`
      : r.details;

    lines.push(`  ${icon} ${r.toolClaimed} — ${r.verdict}`);
    lines.push(`    Claimed at: ${r.claimedAt.slice(11, 19)}`);
    lines.push(`    ${detail}`);
    lines.push("");

    if (r.verdict === "VERIFIED") verified++;
    else if (r.verdict === "FABRICATED") fabricated++;
    else unverifiable++;
  }

  lines.push("─────────────────────────────────");
  lines.push(`  ✓ Verified: ${verified}`);
  lines.push(`  ✗ Fabricated: ${fabricated}`);
  lines.push(`  ? Unverifiable: ${unverifiable}`);
  lines.push(`  Total claims: ${results.length}`);

  return lines.join("\n");
}
