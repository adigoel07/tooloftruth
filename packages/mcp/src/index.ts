import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
import type { ToolCallRecord, TokenUsage } from "@tooloftruth/core";
import { McpProxy } from "./proxy.js";

const TOOLOFTRUTH_DIR = join(homedir(), ".tooloftruth");

const verifier = new Verifier();
const store = new ReceiptStore(TOOLOFTRUTH_DIR);
const manifests = loadAllManifests(TOOLOFTRUTH_DIR);
const proxy = new McpProxy(TOOLOFTRUTH_DIR);

const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const sessionCalls: ToolCallRecord[] = [];

function recordCall(record: ToolCallRecord): void {
  record.sessionId = sessionId;
  sessionCalls.push(record);
  store.appendCall(record);
}

const server = new McpServer({
  name: "tooloftruth",
  version: "0.1.0",
});

// ─── Tool of Truth's own tools ────────────────────────────────

server.tool(
  "tooloftruth_verify",
  "Verify that a specific tool was actually used in this session",
  { tool: z.string().describe("Name of the tool to verify") },
  async ({ tool }) => {
    const calls = sessionCalls.filter(
      (c) => c.tool === tool || c.server === tool
    );
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
  { tool: z.string().describe("Name of the tool to check") },
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
    action: z.enum(["generate", "view", "list"]).describe("Action to perform"),
    receiptId: z.string().optional().describe("Receipt ID (for view)"),
  },
  async ({ action, receiptId }) => {
    if (action === "generate") {
      const receipt = buildReceipt(
        sessionCalls,
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
              sessionCalls.map((c) => ({
                id: c.id,
                tool: c.tool,
                server: c.server,
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
          text: receiptId
            ? `Receipt '${receiptId}' — full view coming in v2.`
            : "Provide a receiptId to view.",
        },
      ],
    };
  }
);

server.tool(
  "tooloftruth_cost",
  "Get cost breakdown for tool usage in this session",
  {
    period: z
      .enum(["session", "day", "week"])
      .default("session")
      .describe("Time period"),
    tool: z.string().optional().describe("Filter by specific tool"),
  },
  async ({ tool }) => {
    const filtered = tool
      ? sessionCalls.filter((c) => c.tool === tool || c.server === tool)
      : sessionCalls;
    const breakdown = buildCostBreakdown(filtered);
    return {
      content: [
        { type: "text" as const, text: formatCostReport(breakdown) },
      ],
    };
  }
);

server.tool(
  "tooloftruth_history",
  "Search historical verification receipts",
  {
    tool: z.string().optional().describe("Filter by tool"),
    limit: z.number().default(20).describe("Max results"),
  },
  async ({ tool, limit }) => {
    const records = tool ? store.queryTool(tool) : sessionCalls;
    const sliced = records.slice(-limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: sliced.length,
              records: sliced.map((r: ToolCallRecord) => ({
                id: r.id,
                tool: r.tool,
                server: r.server,
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
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sessionId,
              totalCalls: sessionCalls.length,
              verified: sessionCalls.filter(
                (c) => c.verification.verdict === "VERIFIED"
              ).length,
              fabricated: sessionCalls.filter(
                (c) => c.verification.verdict === "FABRICATION"
              ).length,
              suspicious: sessionCalls.filter(
                (c) => c.verification.verdict === "SUSPICIOUS"
              ).length,
              totalCostUsd: sessionCalls.reduce(
                (s, c) => s + c.costUsd,
                0
              ),
              totalTokens: {
                input: sessionCalls.reduce(
                  (s, c) => s + c.tokens.input,
                  0
                ),
                output: sessionCalls.reduce(
                  (s, c) => s + c.tokens.output,
                  0
                ),
              },
              historicalStats: stats,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Proxy: register downstream tools ────────────────────────

async function registerProxyTools(): Promise<void> {
  if (!proxy.isConnected()) return;

  const tools = proxy.getTools();
  for (const tool of tools) {
    const toolName = tool.name;
    const desc = `[proxied via ${tool.serverName}] ${tool.description}`;

    // Build a Zod schema from JSON Schema properties
    const inputSchema = jsonSchemaToZod(tool.inputSchema);

    server.tool(
      toolName,
      desc,
      inputSchema,
      async (args: Record<string, unknown>) => {
        const { result, durationMs, isError, record } =
          await proxy.callTool(toolName, args);

        const manifest = manifests.get(tool.serverName);
        const verification = await verifier.verifyToolCall(record, manifest);
        record.verification = verification;
        record.sessionId = sessionId;

        recordCall(record);

        const content =
          result &&
          typeof result === "object" &&
          "content" in result
            ? (result as { content: unknown }).content
            : [{ type: "text" as const, text: JSON.stringify(result, null, 2) }];

        return { content };
      }
    );
  }
}

function jsonSchemaToZod(schema: unknown): Record<string, z.ZodTypeAny> {
  if (!schema || typeof schema !== "object") {
    return { _: z.record(z.unknown()) };
  }
  const s = schema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
  if (!s.properties) {
    return { _: z.record(z.unknown()) };
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(s.required || []);

  for (const [key, prop] of Object.entries(s.properties)) {
    let zodType: z.ZodTypeAny;
    switch (prop.type) {
      case "string": zodType = z.string(); break;
      case "number": case "integer": zodType = z.number(); break;
      case "boolean": zodType = z.boolean(); break;
      case "array": zodType = z.array(z.unknown()); break;
      default: zodType = z.unknown(); break;
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    if (!required.has(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }

  return shape;
}

// ─── Start ────────────────────────────────────────────────────

async function main() {
  if (proxy.getServerNames().length > 0) {
    await proxy.connectAll();
    await registerProxyTools();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
