// Minimal MCP server for testing — speaks protocol directly over stdio
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, terminal: false });

const TOOLS = [
  {
    name: "echo",
    description: "Echo back the input",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Message to echo" } },
      required: ["message"],
    },
  },
  {
    name: "add",
    description: "Add two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if (msg.method === "initialize") {
    respond(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "test-echo", version: "0.1.0" },
    });
  } else if (msg.method === "tools/list") {
    respond(msg.id, { tools: TOOLS });
  } else if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params;
    if (name === "echo") {
      respond(msg.id, { content: [{ type: "text", text: `Echo: ${args.message}` }] });
    } else if (name === "add") {
      respond(msg.id, { content: [{ type: "text", text: String(args.a + args.b) }] });
    } else {
      respond(msg.id, { error: { code: -32602, message: `Tool ${name} not found` } });
    }
  }
});
