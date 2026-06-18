---
name: wc3-export-safety
description: "Use when changing Warcraft III JASS/Lua/TypeScript export templates, generated frame code, trigger registration, TOC/FDF output, or map-import behavior."
---

# WC3 Export Safety

Use this skill whenever the change affects generated map code.

## Key Files

- `src/ts/ClassesAndFunctions/Export.ts` walks `ProjectTree`, applies templates, writes optional files, and copies export text to the clipboard.
- `src/ts/Templates/Templates.ts` defines JASS, Lua, and TypeScript snippets.
- `src/ts/Templates/FrameMLText.ts` builds shared frame API snippets for all export languages.
- `src/ts/Editor/FrameLogic/FrameRequire.ts` controls extra FDF/TOC requirements.

## Warcraft III Risk Checklist

- Memory leaks: generated triggers created with `CreateTrigger()` persist for the map session. If new generated code creates timers, groups, locations, effects, forces, or dynamic triggers, include cleanup or explain why it is intentionally permanent.
- Trigger/event behavior: check `BlzTriggerRegisterFrameEvent` registrations for duplicate registration, missing action functions, and array naming collisions.
- Async/timer behavior: avoid introducing waits, timers, or delayed callbacks into generated UI initialization unless the timing is necessary and deterministic.
- Desync risks: do not generate `GetLocalPlayer()` branches that create/destroy frames, triggers, or handles differently per player. Local-only changes should be limited to safe visual state when needed.
- Initialization order: `BlzLoadTOCFile` must happen before frames that require external FDF templates are created.
- Naming: preserve valid JASS/Lua/TypeScript identifiers, array syntax, and the existing `FRvar`/`FRvrr` placeholder replacement behavior.

## Verification

- Run `npm run compile-ts`.
- Check all affected export languages, not only the language in the reported bug.
- For export text changes, inspect generated code for a simple frame, a button-like frame with callbacks, a tooltip case, and an array case when relevant.
