# Skill Manifests

Tool of Truth lets skills declare what tools they call and how to verify the
result. A skill attaches a JSON manifest that the sentinel reads to verify
"correct tools called? right order? right args? output follows rules?"

## Manifest Format

```jsonc
{
  "skill": "last-30-days",
  "version": "2.1.0",
  "requires": {
    "github_mcp": {
      "tool": "get_repo_stats",
      "must_be_called": true,
      "expected_args": { "endpoint": "/repos/*/stats/*" },
      "max_cost": 0.0
    }
  },
  "order": ["github_mcp"],
  "output_rules": [
    "Report must contain dates within the last 30 days",
    "Report must cite sources returned by the tool"
  ]
}
```

## Fields

- **`requires`** — map of MCP server name → expected tool(s), whether they
  *must* be called, expected argument shape, and max cost budget.
- **`order`** — the required call sequence.
- **`output_rules`** — natural-language rules the tool result must satisfy.

## Verification Flow

1. Manifest is parsed and cached in `.tooloftruth/manifests/<skill-name>.json`.
2. On a proxied call, Tool of Truth checks: correct tool? correct server?
   expected args? within cost budget?
3. After the call, it checks the output against `output_rules`.
4. Result feeds the trust score and verdict.

## Registry

The `manifests/` directory holds pre-built manifests for popular skills.
`manifests/_template.json` is a blank starting point.
