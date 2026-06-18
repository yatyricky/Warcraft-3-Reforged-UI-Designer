---
name: wc3-undo-commands
description: "Use when adding or changing an undoable/redoable frame mutation in the Reforged UI Designer — anything that should be captured by Ctrl+Z / Ctrl+Y (move, hide, reparent, reorder, rename, texture, batch edits)."
---

# WC3 Undo/Redo Commands

Use this skill whenever a user-visible frame change must participate in undo/redo. This fork adds many such features (hide, cascade-hide, reorder, batch move, alter-preview), so new mutations should follow the existing command pattern instead of mutating frames directly.

## Pattern

All undoable mutations live in `src/ts/Commands/Implementation/` and extend `SimpleCommand`
(`src/ts/Commands/SimpleCommand.ts`). The base class wires the `ChangeStack` for you:

- `action()` — pushes onto the undo stack (clearing redo), then calls `pureAction()`. Call this when the user performs the change.
- `redo()` — re-applies during a redo; pushes back onto the undo stack, then calls `pureAction()`.
- `undo()` — must reverse the change, then call `super.undo()` to update the redo stack.
- `pureAction()` — abstract; the actual forward mutation. Capture the previous value here so `undo()` can restore it.

## Authoring a new command

1. Create `src/ts/Commands/Implementation/<Name>.ts`, `export default class <Name> extends SimpleCommand`.
2. Store frame references **by name** (`frame.getName()`), not by object, so the command survives reload and tree rebuilds. Re-resolve with `ProjectTree.getInstance().findByName(name)` inside `pureAction()`/`undo()`.
3. In `pureAction()`: resolve the frame, guard with `if (!frame) { debugText('Could not find frame.'); return }`, save the old value into a private `old…?` field, then apply the new value.
4. In `undo()`: resolve the frame, restore the saved old value, then call `super.undo()`. Add a `debugText(...)` note.
5. `redo()` is optional — only override to add a `debugText` log; it must call `super.redo()`.
6. Trigger it from the UI with `new <Name>(args).action()` (see `ParameterEditor.ts`, `MouseFunctions.ts`, `FrameComponent.ts` for call sites).

`ChangeFrameHidden.ts` is the clearest minimal reference. For multi-frame operations follow the `MoveFramesBatch*` / `ChangeFrameOrder` commands, which apply across a list of frames in one undo step.

## Rules

- Never mutate a frame's persisted state outside a command if the change should be undoable — direct `frame.setX()` calls bypass the stack.
- Keep one logical user action = one command = one undo step. Batch related frames inside a single command rather than pushing many.
- After the mutation, keep `ProjectTree` selection and DOM/`ParameterEditor` fields in sync (the same requirement as in `wc3-ui-designer`).
- If the command adds a new persisted field, load it defensively in save/load so older projects still open.

## Verification

- Run `npm run compile-ts`.
- Manually test the full cycle: perform the action, `Ctrl+Z` to undo, `Ctrl+Y` to redo, and confirm the frame and the UI fields all return to the correct state.
