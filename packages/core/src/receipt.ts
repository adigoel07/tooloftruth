import { randomBytes, createHash } from "crypto";
import type {
  Receipt,
  ToolCallRecord,
  SessionSummary,
  AgentInfo,
  TargetInfo,
} from "./types.js";

export function generateReceiptId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return `rcpt_${ts}_${rand}`;
}

export function hashReceipt(receipt: Omit<Receipt, "receiptHash">): string {
  const content = JSON.stringify(receipt);
  return createHash("sha256").update(content).digest("hex");
}

export function buildReceipt(
  calls: ToolCallRecord[],
  agent: AgentInfo,
  target: TargetInfo
): Receipt {
  const summary: SessionSummary = {
    totalCalls: calls.length,
    verified: calls.filter((c) => c.verification.verdict === "VERIFIED")
      .length,
    fabricated: calls.filter(
      (c) => c.verification.verdict === "FABRICATION"
    ).length,
    suspicious: calls.filter(
      (c) => c.verification.verdict === "SUSPICIOUS"
    ).length,
    totalCostUsd: calls.reduce((sum, c) => sum + c.costUsd, 0),
    totalTokens: {
      input: calls.reduce((sum, c) => sum + c.tokens.input, 0),
      output: calls.reduce((sum, c) => sum + c.tokens.output, 0),
    },
    avgTrustScore:
      calls.length > 0
        ? Math.round(
            calls.reduce((sum, c) => sum + c.verification.trustScore, 0) /
              calls.length
          )
        : 0,
  };

  const receiptBase = {
    version: "1.0.0" as const,
    id: generateReceiptId(),
    timestamp: new Date().toISOString(),
    tooloftruthVersion: "0.1.0",
    agent,
    target,
    calls,
    sessionSummary: summary,
  };

  const receiptHash = hashReceipt(receiptBase);

  return { ...receiptBase, receiptHash };
}

export function formatReceiptHuman(receipt: Receipt): string {
  const lines = [
    "╔══════════════════════════════════════════════════╗",
    "║          Tool of Truth Receipt                   ║",
    "╠══════════════════════════════════════════════════╣",
    `║ Tool: ${receipt.target.name.padEnd(40)}║`,
    `║ Agent: ${receipt.agent.name.padEnd(39)}║`,
    `║ Time: ${receipt.timestamp.slice(0, 19).padEnd(40)}║`,
    "║                                                  ║",
    "║ ┌─ Summary ─────────────────────────────────┐    ║",
    `║ │ Total calls: ${String(receipt.sessionSummary.totalCalls).padEnd(28)}│    ║`,
    `║ │ Verified: ${String(receipt.sessionSummary.verified).padEnd(32)}│    ║`,
    `║ │ Fabricated: ${String(receipt.sessionSummary.fabricated).padEnd(29)}│    ║`,
    `║ │ Avg trust: ${String(receipt.sessionSummary.avgTrustScore + "/100").padEnd(30)}│    ║`,
    `║ │ Total cost: $${receipt.sessionSummary.totalCostUsd.toFixed(4).padEnd(28)}│    ║`,
    "║ └────────────────────────────────────────────┘    ║",
    "║                                                  ║",
    `║ Receipt: ${receipt.id.padEnd(37)}║`,
    `║ Hash: sha256:${receipt.receiptHash.slice(0, 16)}...${" ".repeat(14)}║`,
    "╚══════════════════════════════════════════════════╝",
  ];
  return lines.join("\n");
}
