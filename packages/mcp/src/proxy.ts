import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ToolCallRecord, TokenUsage } from "@tooloftruth/core";

export interface DownstreamServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ProxyConfig {
  servers: Record<string, DownstreamServer>;
}

export interface InterceptedTool {
  name: string;
  description: string;
  inputSchema: unknown;
  serverName: string;
  originalName: string;
}

export class McpProxy {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private tools: Map<string, InterceptedTool> = new Map();
  private config: ProxyConfig;
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.config = this.loadConfig();
  }

  private loadConfig(): ProxyConfig {
    const configPath = join(this.baseDir, "proxy.json");
    if (!existsSync(configPath)) {
      return { servers: {} };
    }
    try {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      return { servers: {} };
    }
  }

  async connectAll(): Promise<InterceptedTool[]> {
    const allTools: InterceptedTool[] = [];

    for (const [name, server] of Object.entries(this.config.servers)) {
      try {
        const tools = await this.connectServer(name, server);
        allTools.push(...tools);
      } catch (err) {
        console.error(`[tooloftruth] Failed to connect to ${name}:`, err);
      }
    }

    return allTools;
  }

  private async connectServer(
    name: string,
    server: DownstreamServer
  ): Promise<InterceptedTool[]> {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...process.env, ...server.env } as Record<string, string>,
    });

    const client = new Client({
      name: `tooloftruth-proxy-${name}`,
      version: "0.1.0",
    });

    await client.connect(transport);
    this.clients.set(name, client);
    this.transports.set(name, transport);

    const { tools } = await client.listTools();

    const intercepted: InterceptedTool[] = tools.map((t) => ({
      name: `${name}__${t.name}`,
      description: t.description || "",
      inputSchema: t.inputSchema,
      serverName: name,
      originalName: t.name,
    }));

    for (const tool of intercepted) {
      this.tools.set(tool.name, tool);
    }

    return intercepted;
  }

  async callTool(
    fullName: string,
    args: Record<string, unknown>
  ): Promise<{
    result: unknown;
    durationMs: number;
    isError: boolean;
    record: ToolCallRecord;
  }> {
    const tool = this.tools.get(fullName);
    if (!tool) {
      throw new Error(`Tool '${fullName}' not found in proxy`);
    }

    const client = this.clients.get(tool.serverName);
    if (!client) {
      throw new Error(`Server '${tool.serverName}' not connected`);
    }

    const start = Date.now();
    let result: unknown;
    let isError = false;

    try {
      result = await client.callTool({
        name: tool.originalName,
        arguments: args,
      });
    } catch (err) {
      isError = true;
      result = { error: String(err) };
    }

    const durationMs = Date.now() - start;

    const tokens = this.extractTokens(result);
    const record: ToolCallRecord = {
      id: `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      tool: tool.originalName,
      server: tool.serverName,
      sessionId: "",
      userPrompt: "",
      params: args,
      result: result as Record<string, unknown>,
      durationMs,
      isError,
      tokens,
      costUsd: 0,
      verification: {
        schemaValid: true,
        responsePlausible: true,
        trustScore: 100,
        verdict: "VERIFIED",
        fabricationConfidence: 0,
        checksPerformed: [],
      },
    };

    return { result, durationMs, isError, record };
  }

  private extractTokens(result: unknown): TokenUsage {
    if (!result || typeof result !== "object") return { input: 0, output: 0 };
    const r = result as Record<string, unknown>;
    if (r._meta && typeof r._meta === "object") {
      const meta = r._meta as Record<string, unknown>;
      return {
        input: (meta.inputTokens as number) || 0,
        output: (meta.outputTokens as number) || 0,
      };
    }
    return { input: 0, output: 0 };
  }

  getTools(): InterceptedTool[] {
    return Array.from(this.tools.values());
  }

  getServerNames(): string[] {
    return Object.keys(this.config.servers);
  }

  isConnected(): boolean {
    return this.clients.size > 0;
  }

  async disconnect(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.tools.clear();
  }
}
