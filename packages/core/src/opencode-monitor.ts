import { existsSync } from "fs";
import { createRequire } from "module";
import { homedir } from "os";
import { join } from "path";

// Node's built-in SQLite (node:sqlite). We load it via createRequire because
// tsup strips the "node:" protocol from static imports (node:sqlite → sqlite,
// which is NOT a resolvable npm module). createRequire preserves the specifier.
// Types are intentionally loose here — node:sqlite's exact type names vary
// across @types/node versions, and the dts build must stay dependency-free.
const nodeRequire = createRequire(join(process.cwd(), "package.json"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqliteModule = nodeRequire("node:sqlite") as {
  DatabaseSync: new (path: string, options?: Record<string, unknown>) => {
    close(): void;
    prepare(sql: string): {
      get(...args: unknown[]): unknown;
      all(...args: unknown[]): unknown[];
    };
  };
};
const { DatabaseSync } = sqliteModule;

// Opens and tails the opencode SQLite database so Tool of Truth can monitor
// real agent conversations: every message, tool call, token usage, and cost.
// Uses node:sqlite (Node >= 22.5) — zero runtime dependencies.

export interface OpenCodeMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  timeCreated: number;
  cost: number;
  tokens: { input: number; output: number; total?: number };
  modelID?: string;
  text?: string;
  toolCalls: OpenCodeToolCall[];
}

export interface OpenCodeToolCall {
  tool: string;
  callID?: string;
  status?: string;
  input?: Record<string, unknown>;
  outputPreview?: string;
  durationMs?: number;
  isError?: boolean;
}

export interface OpenCodeMonitorConfig {
  dbPath?: string;
}

export interface OpenCodeMonitor {
  open(): Promise<void>;
  close(): Promise<void>;
  /**
   * Returns all messages with their tool calls, ordered oldest→newest,
   * optionally from a starting timestamp (ms epoch) for incremental tails.
   */
  getMessages(afterTimeMs?: number, limit?: number): Promise<OpenCodeMessage[]>;
  /**
   * Polls for new messages since the last call.
   */
  pollNewMessages(): Promise<OpenCodeMessage[]>;
}

export function createOpenCodeMonitor(
  config: OpenCodeMonitorConfig = {}
): OpenCodeMonitor {
  const dbPath =
    config.dbPath || join(homedir(), ".local", "share", "opencode", "opencode.db");

  let db: InstanceType<typeof DatabaseSync> | null = null;
  let lastSeenTime = 0;

  async function open(): Promise<void> {
    if (db) return;
    if (!existsSync(dbPath)) {
      throw new Error(`opencode.db not found at ${dbPath}`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    // Seed lastSeenTime with the latest message timestamp so the first poll
    // only returns *new* activity after daemon start.
    const row = db.prepare("SELECT MAX(time_created) AS max FROM message").get() as
      | { max: number }
      | undefined;
    lastSeenTime = row?.max || 0;
  }

  async function close(): Promise<void> {
    if (db) {
      db.close();
      db = null;
    }
  }

  async function getMessages(
    afterTimeMs?: number,
    limit = 200
  ): Promise<OpenCodeMessage[]> {
    if (!db) throw new Error("monitor not open");
    const after = afterTimeMs ?? 0;

    const stmt = db.prepare(
      `SELECT id, session_id, time_created, data FROM message
       WHERE time_created > ?
       ORDER BY time_created ASC
       LIMIT ?`
    );
    const rows = stmt.all(after, limit) as Array<{
      id: string;
      session_id: string;
      time_created: number;
      data: string;
    }>;

    const partStmt = db.prepare(
      "SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC"
    );

    const messages: OpenCodeMessage[] = [];
    for (const row of rows) {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }

      const msg: OpenCodeMessage = {
        id: row.id,
        sessionId: row.session_id,
        role: (data.role as OpenCodeMessage["role"]) || "system",
        timeCreated: row.time_created,
        cost: (data.cost as number) || 0,
        tokens: {
          input: (data.tokens as any)?.input || 0,
          output: (data.tokens as any)?.output || 0,
          total: (data.tokens as any)?.total,
        },
        modelID: (data.modelID as string) || undefined,
        toolCalls: [],
      };

      const parts = partStmt.all(row.id) as Array<{ data: string }>;
      for (const p of parts) {
        let partData: Record<string, unknown>;
        try {
          partData = JSON.parse(p.data);
        } catch {
          continue;
        }
        if (partData.type === "text" && typeof partData.text === "string") {
          msg.text = (msg.text || "") + (partData.text as string);
        } else if (partData.type === "tool") {
          const state = (partData.state || {}) as Record<string, unknown>;
          const input = state.input as Record<string, unknown> | undefined;
          msg.toolCalls.push({
            tool: (partData.tool as string) || "unknown",
            callID: (partData.callID as string) || undefined,
            status: (state.status as string) || undefined,
            input,
            outputPreview:
              typeof state.output === "string"
                ? (state.output as string).slice(0, 500)
                : undefined,
            durationMs: (state.durationMs as number) || undefined,
            isError: state.status === "error" || state.status === "failed",
          });
        }
      }

      messages.push(msg);
    }

    return messages;
  }

  async function pollNewMessages(): Promise<OpenCodeMessage[]> {
    const rows = await getMessages(lastSeenTime);
    if (rows.length > 0) {
      lastSeenTime = rows[rows.length - 1].timeCreated;
    }
    return rows;
  }

  return {
    open,
    close,
    getMessages,
    pollNewMessages,
  };
}
