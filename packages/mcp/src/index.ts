import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
} from "@tooloftruth/core";
import type { ToolCallRecord, TokenUsage, SkillManifest } from "@tooloftruth/core";

const TOOLOFTRUTH_DIR = join(homedir(), ".tooloftruth");

const verifier = new Verifier();
const store = new ReceiptStore(TOOLOFTRUTH_DIR);
const manifests = loadAllManifests(TOOLOFTRUTH_DIR);

const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const toolCalls: ToolCallRecord[] = [];

function recordToolCall(
  tool: string,
  server: string,
  params: Record<string, unknown>,
  result: unknown,
  durationMs: number,
  isError: boolean,
  tokens: TokenUsage,
  userPrompt: string
): ToolCallRecord {
  const cost = calculateCost(tokens, server);
  const record: ToolCallRecord = {
    id: `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    tool,
    server,
    sessionId,
    userPrompt,
    params,
    result: result as Record<string, unknown>,
    durationMs,
    isError,
    tokens,
    costUsd: cost,
    verification: {
      schemaValid: true,
      responsePlausible: true,
      trustScore: 100,
      verdict: "VERIFIED",
      fabricationConfidence: 0,
      checksPerformed: [],
    },
  };

  const manifest = manifests.get(server);
  verifier.verifyToolCall(record, manifest).then((v) => {
    record.verification = v;
  });

  toolCalls.push(record);
  store.appendCall(record);
  return record;
}

const server = new McpServer({
  name: "tooloftruth",
  version: "0.1.0",
});

server.tool(
  "tooloftruth_verify",
  "Verify that a specific tool was actually used in this session",
  { tool: { type: "string", description: "Name of the tool to verify" } },
  async ({ tool }) => {
    const calls = toolCalls.filter((c) => c.tool === tool);
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
                receipt: null,
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
  { tool: { type: "string", description: "Name of the tool to check" } },
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
    action: {
      type: "string",
      description: "generate | view | list",
      enum: ["generate", "view", "list"],
    },
    receiptId: { type: "string", description: "Receipt ID (for view)" },
  },
  async ({ action, receiptId }) => {
    if (action === "generate") {
      const receipt = buildReceipt(
        toolCalls,
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
              toolCalls.map((c) => ({
                id: c.id,
                tool: c.tool,
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
          text: `Receipt viewing for '${receiptId}' — coming in v2.`,
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_cost",
  "Get cost breakdown for tool usage in this session",
  {
    period: {
      type: "string",
      description: "session | day | week",
      enum: ["session", "day", "week"],
      default: "session",
    },
    tool: { type: "string", description: "Filter by specific tool" },
  },
  async ({ tool }) => {
    const filtered = tool
      ? toolCalls.filter((c) => c.tool === tool)
      : toolCalls;

    const breakdown = buildCostBreakdown(filtered);
    return {
      content: [
        {
          type: "text" as const,
          text: formatCostReport(breakdown),
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_history",
  "Search historical verification receipts",
  {
    tool: { type: "string", description: "Filter by tool" },
    limit: { type: "number", description: "Max results", default: 20 },
  },
  async ({ tool, limit }) => {
    const maxResults = limit || 20;
    let records = tool ? store.queryTool(tool) : store.getStats().totalCalls > 0 ? toolCalls : [];

    records = records.slice(-maxResults);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: records.length,
              records: records.map((r) => ({
                id: r.id,
                tool: r.tool,
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
    const summary = {
      sessionId,
      totalCalls: toolCalls.length,
      verified: toolCalls.filter((c) => c.verification.verdict === "VERIFIED").length,
      fabricated: toolCalls.filter((c) => c.verification.verdict === "FABRICATION").length,
      suspicious: toolCalls.filter((c) => c.verification.verdict === "SUSPICIOUS").length,
      totalCostUsd: toolCalls.reduce((s, c) => s + c.costUsd, 0),
      totalTokens: {
        input: toolCalls.reduce((s, c) => s + c.tokens.input, 0),
        output: toolCalls.reduce((s, c) => s + c.tokens.output, 0),
      },
      historicalStats: stats,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
