# Tool of Truth

**Every tool call, proven.**

Verification sentinel for AI agent tool usage. MITM proxy that intercepts all MCP tool calls, detects fabrication, tracks costs, verifies outcomes, and infers user satisfaction.

## Features

| Feature | Status | Description |
|---|---|---|
| MITM Proxy | ✅ | Transparently intercepts all MCP tool calls |
| Fabrication Detection | ✅ | 7-signal deep analysis: trace, doc-similarity, timing, placeholders, contradictions |
| Trust Scoring | ✅ | Weighted 0-100 with fabrication cap |
| Cost Tracking | ✅ | Per-call cost for 8 providers |
| Token Counting | ✅ | Input/output tokens per call |
| Outcome Verification | ✅ | Compares tool result against user's original prompt |
| Skill Adherence | ✅ | Verifies workflow via manifests |
| User Satisfaction | ✅ | Infers satisfaction from follow-up messages |
| Receipts | ✅ | SHA-256 hashed, JSON + human-readable |
| Local Storage | ✅ | JSONL daily files + indexed lookup |
| Tool Transparency | ✅ | Shows what downstream tools actually do |

## Quick Start

### 1. Install

```bash
npm install -g tooloftruth-mcp
```

### 2. Connect (Option A: Direct)

```json
// Your agent's MCP config
{
  "tooloftruth": {
    "command": "tooloftruth-mcp"
  }
}
```

### 3. Connect (Option B: Proxy — MITM mode)

```json
// Your agent's MCP config
{
  "tooloftruth": {
    "command": "tooloftruth-mcp"
  }
}
```

```json
// ~/.tooloftruth/proxy.json
{
  "servers": {
    "firecrawl": { "command": "npx", "args": ["firecrawl-mcp"] },
    "github": { "command": "npx", "args": ["@modelcontextprotocol/server-github"] }
  }
}
```

### 4. Use

```
You: Did you actually use firecrawl?
Agent: [calls tooloftruth_verify]
Agent: VERIFIED — firecrawl was called at 10:30:02, trust score 98/100, cost $0.03

You: How much did I spend on tools today?
Agent: [calls tooloftruth_cost]
Agent: Total: $0.47 across 12 tool calls

You: Was that result what I asked for?
Agent: [calls tooloftruth_outcome]
Agent: ALIGNED — tool result matches your request

You: That's wrong, try again
Agent: [calls tooloftruth_satisfaction]
Agent: User appears dissatisfied — result may be wrong
```

## MCP Tools

| Tool | Description |
|---|---|
| `tooloftruth_verify` | Verify a specific tool was used |
| `tooloftruth_check` | Pre-flight: is tool installed/configured? |
| `tooloftruth_receipt` | Generate/view verification receipt |
| `tooloftruth_cost` | Cost breakdown by tool |
| `tooloftruth_history` | Search historical receipts |
| `tooloftruth_truth` | Full session truth report |
| `tooloftruth_satisfaction` | Infer user satisfaction from message |
| `tooloftruth_outcome` | Verify result matches user prompt |

## How the MITM Proxy Works

```
Agent ←→ Tool of Truth ←→ MCP Server (downstream)
              ↓
         Records everything
         Runs deep fabrication checks
         Verifies outcome alignment
         Infers satisfaction
         Generates receipts
         Returns result unchanged
```

## Storage

All data stays on your machine:

```
.tooloftruth/
├── config.json          ← settings
├── index.json           ← fast lookup index
├── proxy.json           ← downstream server config
└── receipts/
    ├── 2026-08-17.jsonl ← today's calls
    └── ...
```

## Skill Manifests

Skills can attach verification manifests:

```json
{
  "skill": "last-30-days",
  "version": "2.1.0",
  "requires": {
    "github_mcp": {
      "tool": "get_repo_stats",
      "mustBeCalled": true
    }
  }
}
```

## Development

```bash
git clone https://github.com/adigoel07/tooloftruth.git
cd tooloftruth
pnpm install
pnpm build
npx vitest run
```

## License

MIT — use it, fork it, build on it.

## Author

Built by [adigoel07](https://github.com/adigoel07).
