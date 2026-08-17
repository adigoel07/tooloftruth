# Quick Start

## Install

```bash
npm install -g tooloftruth-mcp
```

## Connect

Add to your MCP config (location depends on your agent):

### Claude Code
```json
// ~/.claude/claude_desktop_config.json
{
  "mcpServers": {
    "tooloftruth": {
      "command": "tooloftruth-mcp"
    }
  }
}
```

### OpenCode
```json
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "tooloftruth": {
      "command": "tooloftruth-mcp"
    }
  }
}
```

### Cursor
```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "tooloftruth": {
      "command": "tooloftruth-mcp"
    }
  }
}
```

## Verify

Type `/truth` in your agent to verify the last tool interaction, or ask:

```
Did you actually use firecrawl?
```

The agent will call `tooloftruth_verify` and return a verdict with trust score.

## View Costs

Ask your agent:
```
How much did I spend on tools today?
```

The agent will call `tooloftruth_cost` and return a breakdown.

## View All Activity

Ask your agent:
```
What tools did I use this session?
```

The agent will call `tooloftruth_truth` and return the full session report.
