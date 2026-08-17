const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const server = new McpServer({ name: "test-echo", version: "0.1.0" });

server.tool("echo", "Echo back the input", { message: z.string() }, async ({ message }) => ({
  content: [{ type: "text", text: `Echo: ${message}` }],
}));

server.tool("add", "Add two numbers", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

const transport = new StdioServerTransport();
server.connect(transport);
