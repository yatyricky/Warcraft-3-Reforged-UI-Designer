import type { FrameNode, Layout, ProjectDoc, Rect } from '../types';

/**
 * Solve a child rect (in parent-space units, y-up, origin = parent bottom-left)
 * from its layout and the parent rect size.
 *
 * anchoredPosition references the anchor point for point anchors and the
 * *center* of the anchor area for stretch anchors (Unity semantics).
 * The point-anchor case matches Zulaman-WE FrameComponent.cs exactly.
 */
export function solveRect(layout: Layout, parentW: number, parentH: number): Rect {
  const { anchorMin, anchorMax, anchoredPosition: ap, sizeDelta: sd, pivot } = layout;
  const w = (anchorMax.x - anchorMin.x) * parentW + sd.x;
  const h = (anchorMax.y - anchorMin.y) * parentH + sd.y;
  const pivotX = ((anchorMin.x + anchorMax.x) / 2) * parentW + ap.x;
  const pivotY = ((anchorMin.y + anchorMax.y) / 2) * parentH + ap.y;
  const left = pivotX - pivot.x * w;
  const bottom = pivotY - pivot.y * h;
  return { left, bottom, right: left + w, top: bottom + h };
}

export function rectSize(r: Rect): { w: number; h: number } {
  return { w: r.right - r.left, h: r.top - r.bottom };
}

export interface SolvedFrame {
  node: FrameNode;
  /** Absolute rect in root/game-area space, y-up, origin = game area bottom-left. */
  abs: Rect;
  /** Rect relative to the parent frame (parent-space units). */
  rel: Rect;
}

/**
 * Solve absolute rects for the whole tree, top-down.
 * The root spans the game area: left/bottom = 0, right = 0.8, top = 0.6.
 */
export function solveAll(doc: ProjectDoc): Map<string, SolvedFrame> {
  const out = new Map<string, SolvedFrame>();
  const root = doc.frames[doc.rootId];
  if (!root) return out;
  const rootRect: Rect = { left: 0, bottom: 0, right: 0.8, top: 0.6 };
  visit(doc, root, rootRect, out);
  return out;
}

function visit(
  doc: ProjectDoc,
  node: FrameNode,
  parentAbs: Rect,
  out: Map<string, SolvedFrame>,
): void {
  const isRoot = node.parentId === null;
  const pw = parentAbs.right - parentAbs.left;
  const ph = parentAbs.top - parentAbs.bottom;
  const rel = isRoot ? { ...parentAbs } : solveRect(node.layout, pw, ph);
  const abs = isRoot
    ? { ...rel }
    : {
        left: parentAbs.left + rel.left,
        bottom: parentAbs.bottom + rel.bottom,
        right: parentAbs.left + rel.right,
        top: parentAbs.bottom + rel.top,
      };
  out.set(node.id, { node, abs, rel });
  for (const childId of node.childIds) {
    const child = doc.frames[childId];
    if (child) visit(doc, child, abs, out);
  }
}

/** Depth-first ids in render (z) order, skipping collapsed subtrees when asked. */
export function dfsIds(doc: ProjectDoc, collapsed?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const node = doc.frames[id];
    if (!node) return;
    out.push(id);
    if (!collapsed?.has(id)) for (const c of node.childIds) walk(c);
  };
  walk(doc.rootId);
  return out;
}

export function isDescendant(doc: ProjectDoc, ancestorId: string, maybeChildId: string): boolean {
  let cur = doc.frames[maybeChildId]?.parentId ?? null;
  while (cur !== null) {
    if (cur === ancestorId) return true;
    cur = doc.frames[cur]?.parentId ?? null;
  }
  return false;
}

/** Path from root to node, inclusive (for breadcrumbs and cycle-free checks). */
export function pathTo(doc: ProjectDoc, id: string): FrameNode[] {
  const out: FrameNode[] = [];
  let cur: string | null = id;
  while (cur !== null) {
    const node: FrameNode | undefined = doc.frames[cur];
    if (!node) break;
    out.unshift(node);
    cur = node.parentId;
  }
  return out;
}
