import { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { newProjectOp, openOp, saveAsOp, saveOp } from '../persistence/fileOps';

const NUDGE_STEP = 0.01;

/** Global keyboard shortcuts. Ignored while typing in form fields. */
export function useKeyboard(): void {
  useEffect(() => {
    let lastNudge = 0;

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) void saveAsOp();
        else void saveOp();
        return;
      }
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void openOp();
        return;
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void newProjectOp();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selection.length > 0) s.duplicateFrames(s.selection);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length > 0) {
        e.preventDefault();
        s.removeFrames(s.selection);
        return;
      }
      if (e.key === 'Escape') {
        s.select([]);
        return;
      }

      // arrow nudging (coalesces rapid presses into one undo step)
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      if (e.key in deltas && s.selection.length > 0) {
        e.preventDefault();
        const mult = e.shiftKey ? 10 : 1;
        const [dx, dy] = deltas[e.key];
        const now = Date.now();
        const coalesce = now - lastNudge < 800;
        lastNudge = now;
        for (const id of s.selection) {
          const node = s.doc.frames[id];
          if (!node) continue;
          const ap = node.layout.anchoredPosition;
          s.updateLayout(
            id,
            { anchoredPosition: { x: ap.x + dx * NUDGE_STEP * mult, y: ap.y + dy * NUDGE_STEP * mult } },
            !coalesce,
          );
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
