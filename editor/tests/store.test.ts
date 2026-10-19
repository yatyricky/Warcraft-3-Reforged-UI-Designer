import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from '../src/store/editorStore';
import { newProject } from '../src/core/defaults';
import { solveAll } from '../src/core/layout/solve';

function reset(): void {
  useEditor.setState({
    doc: newProject('t'),
    past: [],
    future: [],
    selection: [],
    hoverId: null,
    savedJson: null,
    fileName: null,
    restoreJson: null,
  });
}

const S = () => useEditor.getState();

beforeEach(reset);

describe('tree edits + undo/redo', () => {
  it('addFrame appends to parent and selects it', () => {
    const id = S().addFrame('FRAME')!;
    expect(id).toBeTruthy();
    const root = S().doc.frames[S().doc.rootId];
    expect(root.childIds).toEqual([id]);
    expect(S().selection).toEqual([id]);
    expect(S().past).toHaveLength(1);
  });

  it('removeFrames removes whole subtrees and cleans selection', () => {
    const a = S().addFrame('FRAME')!;
    const b = S().addFrame('IMAGE', a)!;
    S().removeFrames([a]);
    expect(S().doc.frames[a]).toBeUndefined();
    expect(S().doc.frames[b]).toBeUndefined();
    expect(S().doc.frames[S().doc.rootId].childIds).toEqual([]);
    expect(S().selection).toEqual([]);
  });

  it('undo/redo restores doc snapshots', () => {
    S().addFrame('TEXT');
    expect(S().doc.frames[S().doc.rootId].childIds).toHaveLength(1);
    S().undo();
    expect(S().doc.frames[S().doc.rootId].childIds).toHaveLength(0);
    S().redo();
    expect(S().doc.frames[S().doc.rootId].childIds).toHaveLength(1);
  });

  it('new commits clear the redo stack', () => {
    S().addFrame('TEXT');
    S().undo();
    expect(S().future).toHaveLength(1);
    S().addFrame('IMAGE');
    expect(S().future).toHaveLength(0);
  });

  it('duplicateFrames clones subtrees with unique names and offsets', () => {
    const a = S().addFrame('FRAME')!;
    S().duplicateFrames([a]);
    const root = S().doc.frames[S().doc.rootId];
    expect(root.childIds).toHaveLength(2);
    const original = S().doc.frames[a];
    const clone = S().doc.frames[root.childIds[1]];
    expect(clone.id).not.toBe(a);
    expect(clone.name.toLowerCase()).not.toBe(original.name.toLowerCase());
    expect(clone.layout.anchoredPosition.x).toBeCloseTo(original.layout.anchoredPosition.x + 0.02, 6);
  });

  it('reparent rejects cycles', () => {
    const a = S().addFrame('FRAME')!;
    const b = S().addFrame('FRAME', a)!;
    // moving A into its own descendant B must be refused
    expect(S().reparent(a, b, 'into')).toBe(false);
    const root = S().doc.frames[S().doc.rootId];
    expect(root.childIds).toEqual([a]);
  });

  it('reparent before/after/into positions correctly', () => {
    const a = S().addFrame('FRAME')!;
    const b = S().addFrame('FRAME')!;
    const c = S().addFrame('FRAME')!;
    const rootId = S().doc.rootId;
    // move c before a: [c, a, b]
    expect(S().reparent(c, a, 'before')).toBe(true);
    expect(S().doc.frames[rootId].childIds).toEqual([c, a, b]);
    // move b into a
    expect(S().reparent(b, a, 'into')).toBe(true);
    expect(S().doc.frames[a].childIds).toEqual([b]);
    expect(S().doc.frames[rootId].childIds).toEqual([c, a]);
    // reorder within same parent: a before c
    expect(S().reparent(a, c, 'before')).toBe(true);
    expect(S().doc.frames[rootId].childIds).toEqual([a, c]);
    // undo twice: first undoes "a before c", second undoes "b into a"
    S().undo();
    expect(S().doc.frames[rootId].childIds).toEqual([c, a]);
    expect(S().doc.frames[a].childIds).toEqual([b]);
    S().undo();
    expect(S().doc.frames[rootId].childIds).toEqual([c, a, b]);
    expect(S().doc.frames[a].childIds).toEqual([]);
  });

  it('reparent same position is a no-op without history', () => {
    S().addFrame('FRAME');
    S().addFrame('FRAME');
    const rootId = S().doc.rootId;
    const before = S().past.length;
    const [a, b] = S().doc.frames[rootId].childIds;
    expect(S().reparent(b, a, 'after')).toBe(false);
    expect(S().past.length).toBe(before);
  });
});

describe('layout updates solve through the tree', () => {
  it('updating a parent moves its children', () => {
    const a = S().addFrame('FRAME')!;
    const b = S().addFrame('IMAGE', a)!;
    S().updateLayout(a, { anchoredPosition: { x: 0.1, y: 0.1 } });
    const solved = solveAll(S().doc);
    const childBefore = solved.get(b)!;
    expect(childBefore.abs.left).toBeCloseTo(0.4 + 0.1 - 0.05, 6);
  });

  it('preview mutations skip history', () => {
    const a = S().addFrame('FRAME')!;
    const pastLen = S().past.length;
    S().updateLayout(a, { sizeDelta: { x: 0.3, y: 0.3 } }, false);
    expect(S().past.length).toBe(pastLen);
    expect(S().doc.frames[a].layout.sizeDelta).toEqual({ x: 0.3, y: 0.3 });
  });
});

describe('props & flags', () => {
  it('setProps merges patches', () => {
    const a = S().addFrame('TEXT')!;
    S().setProps(a, { text: 'hello', color: '#123456' });
    expect(S().doc.frames[a].props.text).toBe('hello');
    expect(S().doc.frames[a].props.texture).toBe('');
    S().undo();
    expect(S().doc.frames[a].props.text).toBe('文本');
  });

  it('setFlags toggles visibility', () => {
    const a = S().addFrame('FRAME')!;
    S().setFlags(a, { visible: false });
    expect(S().doc.frames[a].visible).toBe(false);
  });
});

describe('project meta', () => {
  it('rename project is undoable', () => {
    S().setProjectMeta({ name: '新名字' });
    expect(S().doc.name).toBe('新名字');
    S().undo();
    expect(S().doc.name).toBe('t');
  });
});
