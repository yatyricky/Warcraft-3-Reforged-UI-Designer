import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { makeFrame, nextFrameName, newProject } from '../core/defaults';
import { newId } from '../core/ids';
import { isDescendant } from '../core/layout/solve';
import type { FrameNode, FrameProps, FrameType, Layout, ProjectDoc, ProjectSettings } from '../core/types';
import { saveProjectJson } from '../core/serialize';

const HISTORY_LIMIT = 100;

export interface Viewport {
  /** pan offset in container px */
  x: number;
  y: number;
  zoom: number;
}

export type DropMode = 'before' | 'after' | 'into';

interface EditorStore {
  doc: ProjectDoc;
  past: ProjectDoc[];
  future: ProjectDoc[];
  selection: string[];
  hoverId: string | null;
  viewport: Viewport;
  /** JSON of the last saved/opened state; dirty = current differs. */
  savedJson: string | null;
  fileName: string | null;
  /** Set when an autosave snapshot exists for restore. */
  restoreJson: string | null;

  // --- history ---
  /** Push current doc onto the undo stack (call once before a gesture). */
  pushHistory(): void;
  /** Mutate doc without touching history (live drag preview). */
  preview(recipe: (doc: Draft<ProjectDoc>) => void): void;
  /** Undoable discrete mutation. */
  commit(recipe: (doc: Draft<ProjectDoc>) => void): void;
  undo(): void;
  redo(): void;

  // --- selection ---
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  setHover(id: string | null): void;

  // --- tree edits ---
  addFrame(type: FrameType, parentId?: string): string | null;
  removeFrames(ids: string[]): void;
  duplicateFrames(ids: string[]): void;
  reparent(id: string, targetId: string, mode: DropMode): boolean;
  setFrameName(id: string, name: string): void;
  setFlags(id: string, flags: Partial<Pick<FrameNode, 'active' | 'visible' | 'raycastTarget'>>): void;
  updateLayout(id: string, patch: Partial<Layout>, history?: boolean): void;
  setProps(id: string, patch: Partial<FrameProps>, history?: boolean): void;

  // --- project ---
  setProjectMeta(patch: Partial<Pick<ProjectDoc, 'name' | 'libraryName'>>): void;
  setSettings(patch: Partial<ProjectSettings>): void;
  setViewport(vp: Viewport): void;
  loadDoc(doc: ProjectDoc, fileName: string | null): void;
  markSaved(): void;
  setRestore(json: string | null): void;
}

/** Detach a node from its current parent (draft-safe). */
function detach(draft: ProjectDoc, id: string): void {
  const node = draft.frames[id];
  if (!node || node.parentId === null) return;
  const parent = draft.frames[node.parentId];
  if (parent) {
    const i = parent.childIds.indexOf(id);
    if (i >= 0) parent.childIds.splice(i, 1);
  }
}

/** Deep-copy layout vectors. */
function copyLayout(src: Layout): Layout {
  return {
    anchorMin: { ...src.anchorMin },
    anchorMax: { ...src.anchorMax },
    anchoredPosition: { ...src.anchoredPosition },
    sizeDelta: { ...src.sizeDelta },
    pivot: { ...src.pivot },
  };
}

/** Deep-copy a subtree with fresh ids, fixing parent links. */
function copySubtree(draft: ProjectDoc, id: string, newParentId: string): string | null {
  const src = draft.frames[id];
  if (!src) return null;
  const cloneId = newId();
  const clone: FrameNode = {
    id: cloneId,
    name: src.name,
    type: src.type,
    active: src.active,
    visible: src.visible,
    raycastTarget: src.raycastTarget,
    layout: copyLayout(src.layout),
    props: { ...src.props },
    childIds: [],
    parentId: newParentId,
  };
  draft.frames[cloneId] = clone;
  for (const childId of src.childIds) {
    const newChildId = copySubtree(draft, childId, cloneId);
    if (newChildId) clone.childIds.push(newChildId);
  }
  return cloneId;
}

export const useEditor = create<EditorStore>((set, get) => ({
  doc: newProject(),
  past: [],
  future: [],
  selection: [],
  hoverId: null,
  viewport: { x: 0, y: 0, zoom: 0.5 },
  savedJson: null,
  fileName: null,
  restoreJson: null,

  pushHistory: () => {
    const { doc, past } = get();
    const nextPast = [...past, doc];
    while (nextPast.length > HISTORY_LIMIT) nextPast.shift();
    set({ past: nextPast, future: [] });
  },

  preview: (recipe) => {
    set({ doc: produce(get().doc, recipe) });
  },

  commit: (recipe) => {
    get().pushHistory();
    get().preview(recipe);
  },

  undo: () => {
    const { past, doc, future, selection } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      doc: prev,
      past: past.slice(0, -1),
      future: [doc, ...future].slice(0, HISTORY_LIMIT),
      selection: selection.filter((id) => prev.frames[id]),
    });
  },

  redo: () => {
    const { past, doc, future, selection } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      doc: next,
      past: [...past, doc].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      selection: selection.filter((id) => next.frames[id]),
    });
  },

  select: (ids) => set({ selection: ids }),
  toggleSelect: (id) => {
    const sel = get().selection;
    set({ selection: sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id] });
  },
  setHover: (id) => set({ hoverId: id }),

  addFrame: (type, parentId) => {
    const { doc } = get();
    const parent = doc.frames[parentId ?? doc.rootId];
    if (!parent) return null;
    const name = nextFrameName(type, doc.frames);
    const node = makeFrame(type, name, parent);
    get().commit((draft) => {
      draft.frames[node.id] = node;
      const p = draft.frames[node.parentId!];
      if (p) p.childIds.push(node.id);
    });
    set({ selection: [node.id] });
    return node.id;
  },

  removeFrames: (ids) => {
    if (ids.length === 0) return;
    get().commit((draft) => {
      // union of each requested node's subtree
      const doomed = new Set<string>();
      const collect = (nid: string) => {
        if (doomed.has(nid)) return;
        doomed.add(nid);
        const n = draft.frames[nid];
        if (n) for (const c of n.childIds) collect(c);
      };
      for (const id of ids) collect(id);
      for (const id of ids) detach(draft, id);
      for (const id of doomed) delete draft.frames[id];
    });
    set({ selection: [], hoverId: null });
  },

  duplicateFrames: (ids) => {
    if (ids.length === 0) return;
    const newIds: string[] = [];
    get().commit((draft) => {
      const taken = new Set(Object.values(draft.frames).map((n) => n.name.toLowerCase()));
      for (const id of ids) {
        const node = draft.frames[id];
        if (!node || !node.parentId) continue;
        const parentId = node.parentId;
        const newId_ = copySubtree(draft, id, parentId);
        if (!newId_) continue;
        const clone = draft.frames[newId_];
        if (taken.has(clone.name.toLowerCase())) {
          let i = 2;
          while (taken.has(`${clone.name}${i}`.toLowerCase())) i += 1;
          clone.name = `${clone.name}${i}`;
        }
        taken.add(clone.name.toLowerCase());
        clone.layout.anchoredPosition.x += 0.02;
        clone.layout.anchoredPosition.y -= 0.02;
        const parent = draft.frames[parentId];
        const idx = parent.childIds.indexOf(id);
        parent.childIds.splice(idx + 1, 0, newId_);
        newIds.push(newId_);
      }
    });
    if (newIds.length > 0) set({ selection: newIds });
  },

  reparent: (id, targetId, mode) => {
    const { doc } = get();
    if (id === targetId || id === doc.rootId) return false;
    const node = doc.frames[id];
    const target = doc.frames[targetId];
    if (!node || !target) return false;
    const newParentId = mode === 'into' ? targetId : target.parentId;
    if (newParentId === null) return false;
    if (id === newParentId) return false;
    if (isDescendant(doc, id, newParentId)) return false;

    // compute insertion index in the sibling list *without* the moved node
    const parent = doc.frames[newParentId];
    const siblings = parent.childIds.filter((c) => c !== id);
    let index: number;
    if (mode === 'into') {
      index = siblings.length;
    } else {
      const t = siblings.indexOf(targetId);
      if (t < 0) return false;
      index = mode === 'before' ? t : t + 1;
    }
    // no-op check: same parent, same resulting position
    if (node.parentId === newParentId) {
      const cur = parent.childIds.indexOf(id);
      if (cur === index) return false;
    }
    get().commit((draft) => {
      detach(draft, id);
      const p = draft.frames[newParentId];
      const idx = Math.max(0, Math.min(index, p.childIds.length));
      const n = draft.frames[id];
      n.parentId = newParentId;
      p.childIds.splice(idx, 0, id);
    });
    return true;
  },

  setFrameName: (id, name) => {
    get().commit((draft) => {
      const node = draft.frames[id];
      if (node) node.name = name;
    });
  },

  setFlags: (id, flags) => {
    get().commit((draft) => {
      const node = draft.frames[id];
      if (node) Object.assign(node, flags);
    });
  },

  updateLayout: (id, patch, history = true) => {
    if (history) get().pushHistory();
    get().preview((draft) => {
      const node = draft.frames[id];
      if (node) Object.assign(node.layout, patch);
    });
  },

  setProps: (id, patch, history = true) => {
    if (history) get().pushHistory();
    get().preview((draft) => {
      const node = draft.frames[id];
      if (node) Object.assign(node.props, patch);
    });
  },

  setProjectMeta: (patch) => {
    get().commit((draft) => {
      Object.assign(draft, patch);
    });
  },

  setSettings: (patch) => {
    get().commit((draft) => {
      Object.assign(draft.settings, patch);
    });
  },

  setViewport: (vp) => set({ viewport: vp }),

  loadDoc: (doc, fileName) => {
    set({
      doc,
      past: [],
      future: [],
      selection: [],
      hoverId: null,
      savedJson: saveProjectJson(doc),
      fileName,
    });
  },

  markSaved: () => {
    set({ savedJson: saveProjectJson(get().doc) });
  },

  setRestore: (json) => set({ restoreJson: json }),
}));
