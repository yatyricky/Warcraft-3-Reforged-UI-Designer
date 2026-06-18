---
name: codegraph
description: "Use CodeGraph MCP for codebase questions, architecture, call paths, symbol lookup, and impact analysis when .codegraph/ exists. Prefer over grep/read exploration."
---

# CodeGraph

Pre-indexed local knowledge graph at `.codegraph/`. MCP config: `.cursor/mcp.json`.

## Setup (once per machine)

```bash
npm i -g @colbymchenry/codegraph   # or: irm .../install.ps1 | iex
codegraph install --target=cursor --location=local --yes
codegraph init                      # in project root — already done here
```

Restart Cursor after MCP config changes.

## Tool selection

| Question | Tool |
|----------|------|
| Almost anything — how X works, flows, surveying an area | `codegraph_explore` |
| Where is symbol X? | `codegraph_search` |
| What calls X? / what breaks if I change X? | `codegraph_callers` / `codegraph_impact` |
| What does X call? | `codegraph_callees` |
| Full body of one symbol (or every overload of a name) | `codegraph_node` + `includeCode: true` |
| Files in directory X | `codegraph_files` |
| Is index ready? pending files? | `codegraph_status` |

## Rules

- **One explore call** usually replaces dozens of grep/read steps — use it first.
- **Do not grep to confirm** CodeGraph output; it is AST-indexed.
- **Staleness banner** — if present, `Read` only the listed pending files.
- **No index** — if `.codegraph/` is missing, run `codegraph init` or work with built-in tools.
- **Subagents** — pass symbol names to `codegraph_explore` instead of launching explore subagents for lookup.

## CLI equivalents (no MCP)

```bash
codegraph explore "how does undo work"
codegraph search SimpleCommand
codegraph status
codegraph sync          # only if watcher disabled
```

Auto-sync is on by default while the MCP server runs; manual `codegraph sync` is rarely needed.
