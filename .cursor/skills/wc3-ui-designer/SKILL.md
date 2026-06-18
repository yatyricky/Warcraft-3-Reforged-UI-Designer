---
name: wc3-ui-designer
description: "Use when changing or explaining the Warcraft III Reforged UI Designer Electron/TypeScript app, especially editor state, frame movement, persistence, menus, or command behavior."
---

# WC3 UI Designer

Use this skill for general work in this repo.

## Project Shape

- This is an Electron 9 desktop app written in TypeScript. `npm run build` compiles TypeScript into `app/` and copies layout, styles, JS, and runtime files.
- Main process entry: `src/ts/app.ts` -> `src/ts/main.ts`.
- Renderer bootstrap: `src/ts/renderer.ts`.
- UI shell and menus: `src/layout/`, `src/ts/Editor/Editor.ts`, `src/ts/Editor/Menus/`.
- Frame model: `src/ts/Editor/FrameLogic/FrameComponent.ts`, `CustomComplex.ts`, `FrameBaseContent.ts`, `FrameBuilder.ts`, and `FrameType.ts`.
- Project state and selection tree: `src/ts/Editor/ProjectTree.ts`.
- Undo/redo and mutations: `src/ts/Commands/`, especially `Commands/Implementation/`.
- Save/load: `src/ts/Persistence/`.
- Export generation: `src/ts/ClassesAndFunctions/Export.ts` and `src/ts/Templates/`.

## Working Rules

- Prefer small, direct changes that follow the existing class layout. Avoid broad refactors unless the request is explicitly a rework.
- Preserve existing save-file compatibility. When adding persisted fields, load missing keys defensively and keep older projects opening.
- Route user-visible frame mutations through command classes when undo/redo should capture the change.
- Keep `ProjectTree` selection and DOM state synchronized after creating, deleting, moving, hiding, parenting, or loading frames.
- Treat build outputs in `app/`, `Build/`, and `dist/` as generated unless the user specifically asks to inspect packaged output.

## Verification

- For code changes, run `npm run compile-ts` first. Run `npm run lint` when the change touches style-sensitive TypeScript or broad modules.
- `npm run start` rebuilds and launches Electron, but it requires `src/ts/configMain.ts` as described in `README.md`.
- If adding or changing generated Warcraft III code, inspect the exported strings manually in addition to TypeScript compilation.
