import { useEditor } from '../../store/editorStore';
import type { SolvedFrame } from '../../core/layout/solve';
import type { FrameNode } from '../../core/types';
import { GAME_AREA_PX, PX_PER_UNIT } from '../../core/types';

const HANDLES: Array<{ h: string; cx: number; cy: number }> = [
  { h: 'nw', cx: 0, cy: 0 },
  { h: 'n', cx: 0.5, cy: 0 },
  { h: 'ne', cx: 1, cy: 0 },
  { h: 'e', cx: 1, cy: 0.5 },
  { h: 'se', cx: 1, cy: 1 },
  { h: 's', cx: 0.5, cy: 1 },
  { h: 'sw', cx: 0, cy: 1 },
  { h: 'w', cx: 0, cy: 0.5 },
];

/** Stage-space overlay: selection outlines, handles, pivot, anchor gizmos. */
export function SelectionOverlay(props: { solved: Map<string, SolvedFrame>; zoom: number }) {
  const { solved, zoom } = props;
  const selection = useEditor((s) => s.selection);
  const hoverId = useEditor((s) => s.hoverId);
  const doc = useEditor((s) => s.doc);
  const selectedSet = new Set(selection);

  const px = (r: { left: number; bottom: number; right: number; top: number }) => ({
    x: GAME_AREA_PX.x + r.left * PX_PER_UNIT,
    y: GAME_AREA_PX.y + (0.6 - r.top) * PX_PER_UNIT,
    w: (r.right - r.left) * PX_PER_UNIT,
    h: (r.top - r.bottom) * PX_PER_UNIT,
  });

  const handleSize = 9 / zoom;
  const border = 1.5 / zoom;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ overflow: 'visible' }}>
      {/* hover outline */}
      {hoverId && hoverId !== doc.rootId && !selectedSet.has(hoverId) && (
        <HoverOutline s={solved.get(hoverId)} px={px} border={border} />
      )}

      {/* selection outlines */}
      {selection.map((id) => {
        if (id === doc.rootId) return null;
        const s = solved.get(id);
        if (!s) return null;
        const p = px(s.abs);
        return (
          <div
            key={id}
            className="absolute border border-[var(--ed-accent)]"
            style={{
              left: p.x - border,
              top: p.y - border,
              width: p.w,
              height: p.h,
              borderWidth: border,
            }}
          />
        );
      })}

      {/* single-selection extras */}
      {selection.length === 1 &&
        (() => {
          const id = selection[0];
          if (id === doc.rootId) return null;
          const s = solved.get(id);
          if (!s) return null;
          const p = px(s.abs);
          const parent = s.node.parentId ? solved.get(s.node.parentId) : undefined;
          const pAbs = parent ? px(parent.abs) : { x: GAME_AREA_PX.x, y: GAME_AREA_PX.y, w: GAME_AREA_PX.w, h: GAME_AREA_PX.h };
          const L = s.node.layout;
          const dot = 6 / zoom;
          return (
            <div key={`extra-${id}`}>
              {/* anchor gizmo: anchorMin → bottom-left corner, anchorMax → top-right corner */}
              <AnchorLines L={L} p={p} pAbs={pAbs} zoom={zoom} />
              {/* pivot */}
              <div
                className="absolute rounded-full border border-black bg-[#4fc3f7]"
                style={{
                  left: p.x + L.pivot.x * p.w - dot / 2,
                  top: p.y + L.pivot.y * p.h - dot / 2,
                  width: dot,
                  height: dot,
                }}
              />
              {/* resize handles */}
              {HANDLES.map(({ h, cx, cy }) => (
                <div
                  key={h}
                  data-handle={h}
                  className="pointer-events-auto absolute cursor-crosshair rounded-[1px] border border-black bg-[var(--ed-accent)]"
                  style={{
                    left: p.x + cx * p.w - handleSize / 2,
                    top: p.y + cy * p.h - handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    cursor:
                      h === 'n' || h === 's'
                        ? 'ns-resize'
                        : h === 'e' || h === 'w'
                          ? 'ew-resize'
                          : h === 'nw' || h === 'se'
                            ? 'nwse-resize'
                            : 'nesw-resize',
                  }}
                />
              ))}
              {/* label chip */}
              <div
                className="absolute whitespace-nowrap rounded bg-[#111214]/90 px-1 py-px text-[10px] text-[var(--ed-accent)] ed-frame-label"
                style={{
                  left: p.x,
                  top: p.y - 16 / zoom,
                  fontSize: 10 / zoom,
                  padding: `${1 / zoom}px ${3 / zoom}px`,
                }}
              >
                {labelOf(s.node)}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function labelOf(node: FrameNode): string {
  return `${node.name} · ${node.type}`;
}

function HoverOutline(props: {
  s: SolvedFrame | undefined;
  px: (r: { left: number; bottom: number; right: number; top: number }) => { x: number; y: number; w: number; h: number };
  border: number;
}) {
  const { s, px, border } = props;
  if (!s) return null;
  const p = px(s.abs);
  return (
    <div
      className="absolute border border-[#6f87a8]"
      style={{ left: p.x - border, top: p.y - border, width: p.w, height: p.h, borderWidth: border }}
    />
  );
}

function AnchorLines(props: {
  L: { anchorMin: { x: number; y: number }; anchorMax: { x: number; y: number } };
  p: { x: number; y: number; w: number; h: number };
  pAbs: { x: number; y: number; w: number; h: number };
  zoom: number;
}) {
  const { L, p, pAbs, zoom } = props;
  const aMinX = pAbs.x + L.anchorMin.x * pAbs.w;
  const aMinY = pAbs.y + (1 - L.anchorMin.y) * pAbs.h;
  const aMaxX = pAbs.x + L.anchorMax.x * pAbs.w;
  const aMaxY = pAbs.y + (1 - L.anchorMax.y) * pAbs.h;
  const size = 7 / zoom;
  const line = 1 / zoom;
  return (
    <>
      {/* lines */}
      <svg className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none' }}>
        <line
          x1={aMinX}
          y1={aMinY}
          x2={p.x}
          y2={p.y + p.h}
          stroke="#4fc3f7"
          strokeWidth={line}
          opacity={0.9}
        />
        <line
          x1={aMaxX}
          y1={aMaxY}
          x2={p.x + p.w}
          y2={p.y}
          stroke="#4fc3f7"
          strokeWidth={line}
          opacity={0.9}
        />
      </svg>
      {/* anchor point squares */}
      {[{ x: aMinX, y: aMinY }, { x: aMaxX, y: aMaxY }].map((a, i) => (
        <div
          key={i}
          className="absolute border border-black bg-[#4fc3f7]"
          style={{ left: a.x - size / 2, top: a.y - size / 2, width: size, height: size }}
        />
      ))}
    </>
  );
}
