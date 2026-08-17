# Tool of Truth

**Every tool call, proven.**

Verification sentinel for AI agent tool usage. Catches fabrication, tracks costs, proves what actually happened.

## What It Does

AI agents sometimes lie about using tools. They read documentation, mimic expected output, and present fabricated results as if the tool was called. Tool of Truth catches this.

| Feature | Free (Open Source) |
|---|---|
| Fabrication detection | ✓ |
| Tool usage verification | ✓ |
| Trust scoring | ✓ |
| Cost tracking | ✓ |
| Token counting | ✓ |
| Outcome verification | ✓ |
| Skill adherence checking | ✓ |
| User satisfaction inference | ✓ |
| Verification receipts | ✓ |
| Tool transparency | ✓ |

## Quick Start

### Option A: MCP Server (Recommended)

```bash
npm install -g tooloftruth-mcp
```

Add to your MCP config:
```json
"tooloftruth": { "command": "tooloftruth-mcp" }
```

That's it. Every tool call is now intercepted, verified, and recorded.

### Option B: SKILL.md (Fallback)

Add the SKILL.md to your agent's skills directory. The agent will self-verify tool usage.

### Option C: Both (Best)

Connect the MCP server AND load the SKILL.md for maximum coverage.

## Usage

Once connected, use `/truth` or ask your agent to verify tool usage:

```
You: Did you actually use firecrawl?
Agent: [calls tooloftruth_verify]
Agent: VERIFIED — firecrawl was called at 10:30:02, trust score 98/100,
        cost $0.03. Receipt: rcpt_m1x2k3...
```

## How It Works

Tool of Truth sits between your agent and all MCP servers (MITM proxy). Every tool call flows through it transparently:

```
Agent ←→ Tool of Truth ←→ MCP Server
              ↓
         Records everything
         Verifies in real-time
         Returns data to agent
```

The agent doesn't change. You change one line of MCP config. All data stays on your machine.

## Storage

All receipts and logs are stored locally:

```
.tooloftruth/
├── config.json          ← settings
├── index.json           ← fast lookup index
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
      "must_be_called": true
    }
  }
}
```

Tool of Truth verifies: correct tools called? right order? right args? output follows rules?

## Documentation

- [Quick Start](docs/quick-start.md)
- [Verification Checks](docs/verification-checks.md)
- [Skill Manifests](docs/skill-manifests.md)
- [Contributing](docs/contributing.md)

## License

MIT — use it, fork it, build on it.

## Author

Built by [adigoel07](https://github.com/adigoel07).
