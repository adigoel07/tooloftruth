import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "test-echo",
  version: "0.1.0",
});

server.tool(
  "echo",
  "Echo back the input",
  { message: z.string().describe("Message to echo") },
  async ({ message }) => ({
    content: [{ type: "text" as const, text: `Echo: ${message}` }],
  })
);

server.tool(
  "add",
  "Add two numbers",
  {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async ({ a, b }) => ({
    content: [{ type: "text" as const, text: String(a + b) }],
  })
);

const transport = new StdioServerTransport();
server.connect(transport);
