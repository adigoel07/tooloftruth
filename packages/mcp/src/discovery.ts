import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface AgentMcpConfig {
  command?: string | string[];
  args?: string[];
  url?: string;
  type?: string;
}

function findAgentConfigs(): { path: string; format: string }[] {
  const home = homedir();
  const configs: { path: string; format: string }[] = [];

  // OpenCode
  const opencode = join(home, ".config", "opencode", "opencode.json");
  if (existsSync(opencode)) configs.push({ path: opencode, format: "opencode" });

  // Claude Desktop
  const claude = join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  if (existsSync(claude)) configs.push({ path: claude, format: "claude" });

  // Cursor
  const cursor = join(home, ".cursor", "mcp.json");
  if (existsSync(cursor)) configs.push({ path: cursor, format: "cursor" });

  // Windsurf
  const windsurf = join(home, ".windsurf", "mcp.json");
  if (existsSync(windsurf)) configs.push({ path: windsurf, format: "windsurf" });

  // VS Code
  const vscode = join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
  if (existsSync(vscode)) configs.push({ path: vscode, format: "vscode" });

  return configs;
}

function extractMcpServers(configPath: string, format: string): Record<string, AgentMcpConfig> {
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));

    switch (format) {
      case "opencode":
        return (raw.mcp || {}) as Record<string, AgentMcpConfig>;
      case "claude":
        return (raw.mcpServers || {}) as Record<string, AgentMcpConfig>;
      case "cursor":
        return (raw.mcpServers || {}) as Record<string, AgentMcpConfig>;
      case "windsurf":
        return (raw.mcpServers || raw.mcp || {}) as Record<string, AgentMcpConfig>;
      case "vscode":
        return (raw.mcpServers || {}) as Record<string, AgentMcpConfig>;
      default:
        return {};
    }
  } catch {
    return {};
  }
}

export interface DiscoveredServer {
  name: string;
  command: string;
  args: string[];
  source: string;
}

export function discoverDownstreamServers(): DiscoveredServer[] {
  const servers: DiscoveredServer[] = [];
  const configs = findAgentConfigs();

  for (const { path: configPath, format } of configs) {
    const mcpServers = extractMcpServers(configPath, format);

    for (const [name, config] of Object.entries(mcpServers)) {
      // Skip tooloftruth itself
      if (name === "tooloftruth") continue;

      // Skip remote servers (we can only proxy local ones)
      if (config.type === "remote" || config.url) continue;

      // Extract command
      let command: string;
      let args: string[] = [];

      if (Array.isArray(config.command)) {
        command = config.command[0];
        args = config.command.slice(1);
      } else if (typeof config.command === "string") {
        command = config.command;
        args = config.args || [];
      } else {
        continue;
      }

      servers.push({
        name,
        command,
        args,
        source: configPath,
      });
    }
  }

  return servers;
}

export function generateProxyConfig(servers: DiscoveredServer[]): Record<string, unknown> {
  const proxyServers: Record<string, { command: string; args: string[] }> = {};

  for (const server of servers) {
    proxyServers[server.name] = {
      command: server.command,
      args: server.args,
    };
  }

  return { servers: proxyServers };
}
