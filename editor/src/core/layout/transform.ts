import type { Layout, Rect, Vec2 } from '../types';
import { solveRect } from './solve';

/**
 * Inverse transforms: convert editor gestures (parent-space rects/deltas, y-up)
 * back into layout parameters. All pure functions — unit-testable.
 */

/** Translate a layout by a parent-space delta (applies to any anchor mode). */
export function translateLayout(layout: Layout, dx: number, dy: number): Layout {
  return {
    ...layout,
    anchoredPosition: {
      x: layout.anchoredPosition.x + dx,
      y: layout.anchoredPosition.y + dy,
    },
  };
}

/**
 * Re-derive anchoredPosition/sizeDelta from a desired rect while keeping
 * anchors and pivot (the "resize handles" and "anchor preset keeps rect" path).
 */
export function layoutFromRect(
  layout: Layout,
  rect: Rect,
  parentW: number,
  parentH: number,
): Layout {
  const w = rect.right - rect.left;
  const h = rect.top - rect.bottom;
  // pivot position in parent space
  const pivotX = rect.left + layout.pivot.x * w;
  const pivotY = rect.bottom + layout.pivot.y * h;
  const sizeDelta = {
    x: w - (layout.anchorMax.x - layout.anchorMin.x) * parentW,
    y: h - (layout.anchorMax.y - layout.anchorMin.y) * parentH,
  };
  // anchoredPosition = pivotPos - anchorRef, where anchorRef is the anchor
  // point (point anchor) or the center of the anchor area (stretch) — the
  // same reference solveRect uses.
  const refX = ((layout.anchorMin.x + layout.anchorMax.x) / 2) * parentW;
  const refY = ((layout.anchorMin.y + layout.anchorMax.y) / 2) * parentH;
  return {
    ...layout,
    anchoredPosition: { x: pivotX - refX, y: pivotY - refY },
    sizeDelta,
  };
}

/**
 * Apply an anchor preset while preserving the current absolute rect
 * (Unity's default anchor-preset behavior without modifier keys).
 */
export function applyAnchorPreset(
  layout: Layout,
  rect: Rect,
  parentW: number,
  parentH: number,
  anchorMin: Vec2,
  anchorMax: Vec2,
): Layout {
  return layoutFromRect({ ...layout, anchorMin, anchorMax }, rect, parentW, parentH);
}

/** Solve the pivot point of a rect in parent space. */
export function pivotOf(rect: Rect, layout: Layout): Vec2 {
  const w = rect.right - rect.left;
  const h = rect.top - rect.bottom;
  return {
    x: rect.left + layout.pivot.x * w,
    y: rect.bottom + layout.pivot.y * h,
  };
}

export interface SnapCandidates {
  /** Vertical lines (x, parent-space) to snap x-edges/center to. */
  xs: number[];
  /** Horizontal lines (y, parent-space) to snap y-edges/center to. */
  ys: number[];
  /** Optional grid step; when set, positions round to multiples. */
  gridStep?: number;
}

/**
 * Snap a moving rect's edges+center to candidate lines within threshold.
 * Returns the (dx, dy) to apply in parent-space units.
 */
export function snapDelta(
  rect: Rect,
  candidates: SnapCandidates,
  threshold: number,
): { dx: number; dy: number } {
  const myXs = [rect.left, (rect.left + rect.right) / 2, rect.right];
  const myYs = [rect.bottom, (rect.bottom + rect.top) / 2, rect.top];
  let dx = 0;
  let dy = 0;
  let bestX = threshold;
  let bestY = threshold;
  for (const target of candidates.xs) {
    for (const mine of myXs) {
      const d = target - mine;
      if (Math.abs(d) < bestX) {
        bestX = Math.abs(d);
        dx = d;
      }
    }
  }
  for (const target of candidates.ys) {
    for (const mine of myYs) {
      const d = target - mine;
      if (Math.abs(d) < bestY) {
        bestY = Math.abs(d);
        dy = d;
      }
    }
  }
  if (candidates.gridStep && bestX >= threshold && bestY >= threshold) {
    // fall back to grid when no line is near
    dx = Math.round((rect.left + dx) / candidates.gridStep) * candidates.gridStep - rect.left;
    dy = Math.round((rect.bottom + dy) / candidates.gridStep) * candidates.gridStep - rect.bottom;
  }
  return { dx, dy };
}

/**
 * Resize a rect by dragging one of 8 handles. Handles are identified by
 * which edges move: e.g. 'nw' moves left+top edges. Returns the new rect.
 */
export type ResizeHandle =
  | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  minSize = 0.005,
): Rect {
  let { left, bottom, right, top } = rect;
  if (handle.includes('w')) left += dx;
  if (handle.includes('e')) right += dx;
  if (handle.includes('n')) top += dy;
  if (handle.includes('s')) bottom += dy;
  // enforce minimum size, anchoring on the fixed edge
  if (right - left < minSize) {
    if (handle.includes('w')) left = right - minSize;
    else right = left + minSize;
  }
  if (top - bottom < minSize) {
    if (handle.includes('s')) bottom = top - minSize;
    else top = bottom + minSize;
  }
  return { left, bottom, right, top };
}

/** Round layout numbers for stable serialization / display. */
export function roundLayout(layout: Layout, decimals = 5): Layout {
  const r = (v: number) => Number(v.toFixed(decimals));
  return {
    anchorMin: { x: r(layout.anchorMin.x), y: r(layout.anchorMin.y) },
    anchorMax: { x: r(layout.anchorMax.x), y: r(layout.anchorMax.y) },
    anchoredPosition: { x: r(layout.anchoredPosition.x), y: r(layout.anchoredPosition.y) },
    sizeDelta: { x: r(layout.sizeDelta.x), y: r(layout.sizeDelta.y) },
    pivot: { x: r(layout.pivot.x), y: r(layout.pivot.y) },
  };
}

export { solveRect };
