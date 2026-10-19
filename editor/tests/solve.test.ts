import { describe, expect, it } from 'vitest';
import { solveAll, solveRect } from '../src/core/layout/solve';
import {
  applyAnchorPreset,
  layoutFromRect,
  resizeRect,
  snapDelta,
  translateLayout,
  type ResizeHandle,
} from '../src/core/layout/transform';
import { makeFrame, makeRoot, newProject } from '../src/core/defaults';
import type { Layout, Rect } from '../src/core/types';
import { vec2 } from '../src/core/defaults';

const PARENT_W = 0.8;
const PARENT_H = 0.6;

function approx(r: Rect, left: number, bottom: number, right: number, top: number): void {
  expect(r.left).toBeCloseTo(left, 6);
  expect(r.bottom).toBeCloseTo(bottom, 6);
  expect(r.right).toBeCloseTo(right, 6);
  expect(r.top).toBeCloseTo(top, 6);
}

describe('solveRect — golden cases from Zulaman-WE UiTest', () => {
  it('scenario 1: centered panel (point anchor, center pivot)', () => {
    const layout: Layout = {
      anchorMin: vec2(0.5, 0.5),
      anchorMax: vec2(0.5, 0.5),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(0.3, 0.2),
      pivot: vec2(0.5, 0.5),
    };
    approx(solveRect(layout, PARENT_W, PARENT_H), 0.25, 0.2, 0.55, 0.4);
  });

  it('scenario 2: top stretched bar (anchorMin(0,1) anchorMax(1,1))', () => {
    const layout: Layout = {
      anchorMin: vec2(0, 1),
      anchorMax: vec2(1, 1),
      anchoredPosition: vec2(0, -0.05),
      sizeDelta: vec2(-0.1, 0.15),
      pivot: vec2(0.5, 1),
    };
    approx(solveRect(layout, PARENT_W, PARENT_H), 0.05, 0.4, 0.75, 0.55);
  });

  it('scenario 3: corner icon (top-right anchor, top-right pivot)', () => {
    const layout: Layout = {
      anchorMin: vec2(1, 1),
      anchorMax: vec2(1, 1),
      anchoredPosition: vec2(-0.02, -0.02),
      sizeDelta: vec2(0.06, 0.06),
      pivot: vec2(1, 1),
    };
    approx(solveRect(layout, PARENT_W, PARENT_H), 0.72, 0.52, 0.78, 0.58);
  });

  it('non-center pivot point anchor: pivot offset shifts the rect', () => {
    const layout: Layout = {
      anchorMin: vec2(0, 0),
      anchorMax: vec2(0, 0),
      anchoredPosition: vec2(0.1, 0.1),
      sizeDelta: vec2(0.1, 0.1),
      pivot: vec2(0, 0),
    };
    // pivot (bottom-left corner of rect) sits at anchor point (0.1, 0.1)
    approx(solveRect(layout, PARENT_W, PARENT_H), 0.1, 0.1, 0.2, 0.2);
  });
});

describe('layoutFromRect roundtrip', () => {
  const anchorSets: Array<[Layout['anchorMin'], Layout['anchorMax']]> = [
    [vec2(0.5, 0.5), vec2(0.5, 0.5)],
    [vec2(0, 1), vec2(1, 1)],
    [vec2(1, 1), vec2(1, 1)],
    [vec2(0, 0), vec2(1, 0.5)],
  ];
  const pivots = [vec2(0.5, 0.5), vec2(0, 0), vec2(1, 1)];

  for (const [aMin, aMax] of anchorSets) {
    for (const pivot of pivots) {
      it(`anchors(${aMin.x},${aMin.y})-(${aMax.x},${aMax.y}) pivot(${pivot.x},${pivot.y})`, () => {
        const base: Layout = {
          anchorMin: aMin,
          anchorMax: aMax,
          anchoredPosition: vec2(0.03, -0.02),
          sizeDelta: vec2(0.2, 0.12),
          pivot,
        };
        const rect = solveRect(base, PARENT_W, PARENT_H);
        const redone = layoutFromRect(base, rect, PARENT_W, PARENT_H);
        const rect2 = solveRect(redone, PARENT_W, PARENT_H);
        approx(rect2, rect.left, rect.bottom, rect.right, rect.top);
        expect(redone.sizeDelta.x).toBeCloseTo(base.sizeDelta.x, 6);
        expect(redone.sizeDelta.y).toBeCloseTo(base.sizeDelta.y, 6);
        expect(redone.anchoredPosition.x).toBeCloseTo(base.anchoredPosition.x, 6);
        expect(redone.anchoredPosition.y).toBeCloseTo(base.anchoredPosition.y, 6);
      });
    }
  }
});

describe('applyAnchorPreset keeps the rect', () => {
  it('switching a centered rect to top-stretch preserves its geometry', () => {
    const base: Layout = {
      anchorMin: vec2(0.5, 0.5),
      anchorMax: vec2(0.5, 0.5),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(0.3, 0.2),
      pivot: vec2(0.5, 0.5),
    };
    const rect = solveRect(base, PARENT_W, PARENT_H);
    const stretched = applyAnchorPreset(base, rect, PARENT_W, PARENT_H, vec2(0, 1), vec2(1, 1));
    const rect2 = solveRect(stretched, PARENT_W, PARENT_H);
    approx(rect2, rect.left, rect.bottom, rect.right, rect.top);
    expect(stretched.anchorMin).toEqual(vec2(0, 1));
    expect(stretched.anchorMax).toEqual(vec2(1, 1));
  });
});

describe('translateLayout', () => {
  it('shifts stretched anchors uniformly', () => {
    const base: Layout = {
      anchorMin: vec2(0, 1),
      anchorMax: vec2(1, 1),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(-0.1, 0.15),
      pivot: vec2(0.5, 1),
    };
    const r1 = solveRect(base, PARENT_W, PARENT_H);
    const r2 = solveRect(translateLayout(base, 0.05, -0.02), PARENT_W, PARENT_H);
    expect(r2.left - r1.left).toBeCloseTo(0.05, 6);
    expect(r2.right - r1.right).toBeCloseTo(0.05, 6);
    expect(r2.top - r1.top).toBeCloseTo(-0.02, 6);
    expect(r2.bottom - r1.bottom).toBeCloseTo(-0.02, 6);
  });
});

describe('snapDelta', () => {
  it('snaps nearest edge to candidate line within threshold', () => {
    const rect: Rect = { left: 0.101, bottom: 0, right: 0.2, top: 0.1 };
    const { dx } = snapDelta(rect, { xs: [0.1, 0.4], ys: [] }, 0.01);
    expect(dx).toBeCloseTo(-0.001, 6);
  });
  it('ignores lines beyond threshold', () => {
    const rect: Rect = { left: 0.3, bottom: 0, right: 0.4, top: 0.1 };
    const { dx, dy } = snapDelta(rect, { xs: [0.1], ys: [0.5] }, 0.01);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });
  it('grid fallback rounds when no line is near', () => {
    const rect: Rect = { left: 0.104, bottom: 0.096, right: 0.2, top: 0.2 };
    const { dx, dy } = snapDelta(rect, { xs: [], ys: [], gridStep: 0.01 }, 0.004);
    expect(dx).toBeCloseTo(-0.004, 6);
    expect(dy).toBeCloseTo(0.004, 6);
  });
});

describe('resizeRect', () => {
  const base: Rect = { left: 0.1, bottom: 0.1, right: 0.3, top: 0.3 };

  it.each<ResizeHandle>(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])('handle %s moves only its edges', (h) => {
    const r = resizeRect(base, h, 0.05, 0.05, 0.005);
    if (h.includes('w')) expect(r.left).toBeCloseTo(0.15, 6);
    else expect(r.left).toBeCloseTo(0.1, 6);
    if (h.includes('e')) expect(r.right).toBeCloseTo(0.35, 6);
    else expect(r.right).toBeCloseTo(0.3, 6);
    if (h.includes('n')) expect(r.top).toBeCloseTo(0.35, 6);
    else expect(r.top).toBeCloseTo(0.3, 6);
    if (h.includes('s')) expect(r.bottom).toBeCloseTo(0.15, 6);
    else expect(r.bottom).toBeCloseTo(0.1, 6);
  });

  it('enforces minimum size on the dragged edge', () => {
    // dragging the west edge far right collapses against min size
    const r = resizeRect(base, 'w', 1, 0, 0.05);
    expect(r.right).toBeCloseTo(0.3, 6);
    expect(r.left).toBeCloseTo(0.25, 6);
  });
});

describe('solveAll', () => {
  it('resolves nested rects relative to parents', () => {
    const doc = newProject('t');
    const root = doc.frames[doc.rootId];
    const panel = makeFrame('FRAME', 'Panel', root);
    const icon = makeFrame('IMAGE', 'Icon', panel);
    doc.frames[root.id] = root;
    doc.frames[panel.id] = panel;
    doc.frames[icon.id] = icon;
    root.childIds.push(panel.id);
    panel.childIds.push(icon.id);
    panel.layout = {
      anchorMin: vec2(0.5, 0.5),
      anchorMax: vec2(0.5, 0.5),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(0.4, 0.3),
      pivot: vec2(0.5, 0.5),
    };
    icon.layout = {
      anchorMin: vec2(1, 1),
      anchorMax: vec2(1, 1),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(0.06, 0.06),
      pivot: vec2(1, 1),
    };
    const solved = solveAll(doc);
    const panelRect = solved.get(panel.id)!.abs;
    approx(panelRect, 0.2, 0.15, 0.6, 0.45);
    // icon anchors to panel's top-right corner
    const iconRect = solved.get(icon.id)!.abs;
    approx(iconRect, 0.54, 0.39, 0.6, 0.45);
  });

  it('root spans the game area', () => {
    const doc = newProject('t');
    doc.frames[makeRoot().id] = makeRoot();
    const solved = solveAll(doc);
    const r = solved.get(doc.rootId)!.abs;
    approx(r, 0, 0, 0.8, 0.6);
  });
});
