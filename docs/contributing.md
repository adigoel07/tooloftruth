# Contributing

Thanks for helping make Tool of Truth honest-by-default.

## Setup

```bash
git clone https://github.com/adigoel07/tooloftruth.git
cd tooloftruth
pnpm install
pnpm build
pnpm test
```

## Workspace

| Package | Path | What it is |
|---|---|---|
| `@tooloftruth/core` | `packages/core/` | Verification engine (pure logic) |
| `tooloftruth-mcp` | `packages/mcp/` | MCP server + sentinel MITM proxy |
| `tooloftruth` | `packages/cli/` | CLI wrapper + `status` + daemon |

## Conventions

- TypeScript, strict mode, ESM only (`"type": "module"`).
- Core stays dependency-free (pure TypeScript + node built-ins).
- New verification logic goes in `packages/core/src/`, exposed through `index.ts`.
- MCP tools are registered in `packages/mcp/src/index.ts`.
- Every core feature has a Vitest test in `packages/core/src/__tests__/`.

## Before submitting

```bash
pnpm lint          # eslint
pnpm build         # all packages
pnpm test          # vitest, all packages
```

## Release order

Publish dependencies first so consumers get resolvable versions:

1. `@tooloftruth/core`
2. `tooloftruth-mcp` (bundles core via `noExternal` — self-contained)
3. `tooloftruth` (CLI)

## Code of conduct

Be honest. That's the whole point.
