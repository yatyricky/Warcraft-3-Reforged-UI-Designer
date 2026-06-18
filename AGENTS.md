## Warcraft III Reforged UI Designer

Electron/TypeScript desktop app for designing WC3 UI frames and exporting JASS, Lua, or TypeScript for maps.

Detailed Cursor rules: [`.cursor/rules/`](.cursor/rules/). Project skills: [`.cursor/skills/`](.cursor/skills/).

## CodeGraph

<!-- codegraph:begin -->
This project is indexed with [CodeGraph](https://github.com/colbymchenry/codegraph) (`.codegraph/`). MCP server config: [`.cursor/mcp.json`](.cursor/mcp.json).

For codebase questions, use CodeGraph MCP **before** grep or broad file reads:

- `codegraph_explore` — architecture, flows, relevant symbol source in one call
- `codegraph_search` — find symbols by name
- `codegraph_callers` / `codegraph_callees` / `codegraph_impact` — call graph and change impact
- `codegraph_node` — full source for one symbol

The index auto-syncs on file changes while the MCP server is connected. Trust CodeGraph results; only `Read` files flagged in a staleness banner.

Skill: `.cursor/skills/codegraph`
<!-- codegraph:end -->

## Skill routing

| Task | Skill |
|------|-------|
| Editor state, frames, menus, persistence | `wc3-ui-designer` |
| Undoable frame mutations (Ctrl+Z) | `wc3-undo-commands` |
| Export templates, JASS/Lua/TS, TOC/FDF | `wc3-export-safety` |
| Architecture / codebase navigation | `codegraph` |

Use the matching skill from `.cursor/skills/` before deeper work.

## Verification

- `npm run compile-ts` after TypeScript changes
- `npm run lint` for broad or style-sensitive edits
- `npm run start` requires `src/ts/configMain.ts` (see README.md)

When changing generated Warcraft III code, consider memory leaks, cleanup, async/timer behavior, trigger duplication, initialization order, and desync risks.
