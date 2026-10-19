import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { dfsIds, solveAll, type SolvedFrame } from '../../core/layout/solve';
import {
  layoutFromRect,
  resizeRect,
  snapDelta,
  translateLayout,
  type ResizeHandle,
  type SnapCandidates,
} from '../../core/layout/transform';
import type { Layout, Rect } from '../../core/types';
import { GAME_AREA_PX, PX_PER_UNIT, STAGE_H_PX, STAGE_W_PX } from '../../core/types';
import { FrameView } from './FrameView';
import { SelectionOverlay } from './SelectionOverlay';
import { useAssetUrl } from '../../hooks/useAssetUrl';

const GAME_W_UNITS = 0.8;
const GAME_H_UNITS = 0.6;

/** Container-space px of an abs-units point (y-up → y-down). */
function unitsToPx(r: Rect): { x: number; y: number; w: number; h: number } {
  return {
    x: GAME_AREA_PX.x + r.left * PX_PER_UNIT,
    y: GAME_AREA_PX.y + (GAME_H_UNITS - r.top) * PX_PER_UNIT,
    w: (r.right - r.left) * PX_PER_UNIT,
    h: (r.top - r.bottom) * PX_PER_UNIT,
  };
}

function snapCandidates(grid: boolean): SnapCandidates {
  return {
    xs: [0, GAME_W_UNITS / 2, GAME_W_UNITS],
    ys: [0, GAME_H_UNITS / 2, GAME_H_UNITS],
    gridStep: grid ? 0.01 : undefined,
  };
}

type Gesture =
  | { mode: 'pan'; startClientX: number; startClientY: number; startPanX: number; startPanY: number }
  | { mode: 'marquee'; startX: number; startY: number; baseSelection: string[] }
  | {
      mode: 'move';
      startClientX: number;
      startClientY: number;
      deltaUnits: { x: number; y: number };
      origLayouts: Map<string, Layout>;
      primaryAbs: Rect;
      started: boolean;
    }
      | {
          mode: 'resize';
          handle: ResizeHandle;
          id: string;
          startClientX: number;
          startClientY: number;
          startRect: Rect;
          parentAbs: Rect;
          parentW: number;
          parentH: number;
          origLayout: Layout;
          started: boolean;
        };

export function Canvas() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const setHover = useEditor((s) => s.setHover);
  const pushHistory = useEditor((s) => s.pushHistory);
  const preview = useEditor((s) => s.preview);
  const showSafeArea = doc.settings.showSafeArea;
  const showGrid = doc.settings.showGrid;

  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const spaceRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  const solved = useMemo(() => solveAll(doc), [doc]);
  const renderIds = useMemo(() => dfsIds(doc), [doc]);
  const bgUrl = useAssetUrl(
    doc.settings.background === 'custom' ? doc.settings.backgroundImage : '',
    doc.name,
  );

  // initial fit-to-view
  const didFit = useRef(false);
  useLayoutEffect(() => {
    if (didFit.current) return;
    didFit.current = true;
    fitView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitView = useCallback(
    (center = false) => {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const zoom = Math.min(cw / STAGE_W_PX, ch / STAGE_H_PX) * 0.85;
      const x = (cw - STAGE_W_PX * zoom) / 2;
      const y = (ch - STAGE_H_PX * zoom) / 2;
      setViewport({ x, y, zoom });
      void center;
    },
    [setViewport],
  );

  // wheel: pan / ctrl+wheel zoom-to-cursor (non-passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vp = useEditor.getState().viewport;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.pow(2, -e.deltaY * 0.002);
        zoomAt(e.offsetX, e.offsetY, vp.zoom * factor);
      } else {
        setViewport({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // space key tracking for pan mode
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e)) {
        spaceRef.current = true;
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  const zoomAt = (px: number, py: number, newZoomRaw: number) => {
    const vp = useEditor.getState().viewport;
    const newZoom = Math.min(8, Math.max(0.05, newZoomRaw));
    const k = newZoom / vp.zoom;
    setViewport({ zoom: newZoom, x: px - (px - vp.x) * k, y: py - (py - vp.y) * k });
  };

  const zoomCenter = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, useEditor.getState().viewport.zoom * factor);
  };

  // ---- pointer interactions ----

  const onPointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // pan: middle button or space held
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      gestureRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: viewport.x,
        startPanY: viewport.y,
      };
      return;
    }
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const handleEl = target.closest('[data-handle]') as HTMLElement | null;
    const frameEl = target.closest('[data-frame-id]') as HTMLElement | null;

    // resize handle
    if (handleEl && selection.length === 1) {
      const id = selection[0];
      const s = solved.get(id);
      const parent = s?.node.parentId ? solved.get(s.node.parentId) : undefined;
      if (s && parent) {
        const pw = parent.abs.right - parent.abs.left;
        const ph = parent.abs.top - parent.abs.bottom;
        gestureRef.current = {
          mode: 'resize',
          handle: handleEl.dataset.handle as ResizeHandle,
          id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startRect: s.rel,
          parentAbs: parent.abs,
          parentW: pw,
          parentH: ph,
          origLayout: s.node.layout,
          started: false,
        };
        return;
      }
    }

    // frame: select + potential move
    if (frameEl) {
      const id = frameEl.dataset.frameId!;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        toggleSelect(id);
        return;
      }
      if (!selection.includes(id)) select([id]);
      const ids = selection.includes(id) ? selection : [id];
      const origLayouts = new Map<string, Layout>();
      let primaryAbs: Rect = { left: 0, bottom: 0, right: 0, top: 0 };
      for (const selId of ids) {
        const s = solved.get(selId);
        if (s && selId !== doc.rootId) {
          origLayouts.set(selId, s.node.layout);
          if (origLayouts.size === 1) primaryAbs = s.abs;
        }
      }
      if (origLayouts.size === 0) return;
      gestureRef.current = {
        mode: 'move',
        startClientX: e.clientX,
        startClientY: e.clientY,
        deltaUnits: { x: 0, y: 0 },
        origLayouts,
        primaryAbs,
        started: false,
      };
      return;
    }

    // empty: marquee (clear selection unless shift)
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) select([]);
    gestureRef.current = { mode: 'marquee', startX: cx, startY: cy, baseSelection: [...selection] };
    setMarquee({ x: cx, y: cy, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    const el = containerRef.current;
    if (!g || !el) return;
    const rect = el.getBoundingClientRect();

    if (g.mode === 'pan') {
      setViewport({
        ...viewport,
        x: g.startPanX + (e.clientX - g.startClientX),
        y: g.startPanY + (e.clientY - g.startClientY),
      });
      return;
    }

    if (g.mode === 'marquee') {
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const m = {
        x: Math.min(g.startX, cx),
        y: Math.min(g.startY, cy),
        w: Math.abs(cx - g.startX),
        h: Math.abs(cy - g.startY),
      };
      setMarquee(m);
      // live selection: intersect abs rects (stage px) with marquee (container px)
      const vp = viewport;
      const hits: string[] = [];
      for (const [id, s] of solved) {
        if (id === doc.rootId || !s.node.visible || !s.node.active) continue;
        const p = unitsToPx(s.abs);
        const sx = p.x * vp.zoom + vp.x;
        const sy = p.y * vp.zoom + vp.y;
        const sw = p.w * vp.zoom;
        const sh = p.h * vp.zoom;
        if (sx < m.x + m.w && sx + sw > m.x && sy < m.y + m.h && sy + sh > m.y) hits.push(id);
      }
      select(Array.from(new Set([...g.baseSelection, ...hits])));
      return;
    }

    if (g.mode === 'move') {
      const dxScreen = e.clientX - g.startClientX;
      const dyScreen = e.clientY - g.startClientY;
      if (!g.started) {
        if (Math.abs(dxScreen) + Math.abs(dyScreen) < 3) return;
        g.started = true;
        pushHistory();
      }
      const threshold = 8 / viewport.zoom / PX_PER_UNIT;
      let dx = dxScreen / viewport.zoom / PX_PER_UNIT;
      let dy = -dyScreen / viewport.zoom / PX_PER_UNIT;
      // snap using the primary frame's projected abs rect
      const proj: Rect = {
        left: g.primaryAbs.left + dx,
        bottom: g.primaryAbs.bottom + dy,
        right: g.primaryAbs.right + dx,
        top: g.primaryAbs.top + dy,
      };
      const snap = snapDelta(proj, snapCandidates(showGrid), threshold);
      dx += snap.dx;
      dy += snap.dy;
      g.deltaUnits = { x: dx, y: dy };
      preview((draft) => {
        for (const [id, orig] of g.origLayouts) {
          const node = draft.frames[id];
          if (node) node.layout = translateLayout(orig, dx, dy);
        }
      });
      return;
    }

    if (g.mode === 'resize') {
      if (!g.started) {
        g.started = true;
        pushHistory();
      }
      const dx = (e.clientX - g.startClientX) / viewport.zoom / PX_PER_UNIT;
      const dy = -(e.clientY - g.startClientY) / viewport.zoom / PX_PER_UNIT;
      let r = resizeRect(g.startRect, g.handle, dx, dy, 0.01);
      // snap edges (abs space)
      const absProj: Rect = {
        left: g.parentAbs.left + r.left,
        bottom: g.parentAbs.bottom + r.bottom,
        right: g.parentAbs.left + r.right,
        top: g.parentAbs.bottom + r.top,
      };
      const threshold = 8 / viewport.zoom / PX_PER_UNIT;
      const snap = snapDelta(absProj, snapCandidates(showGrid), threshold);
      r = {
        left: r.left + snap.dx,
        bottom: r.bottom + snap.dy,
        right: r.right + snap.dx,
        top: r.top + snap.dy,
      };
      const layout = layoutFromRect(g.origLayout, r, g.parentW, g.parentH);
      preview((draft) => {
        const node = draft.frames[g.id];
        if (node) {
          node.layout.anchoredPosition = layout.anchoredPosition;
          node.layout.sizeDelta = layout.sizeDelta;
        }
      });
    }
  };

  const onPointerUp = () => {
    gestureRef.current = null;
    setMarquee(null);
  };

  // hover outline
  const onFrameEnter = useCallback(
    (id: string) => setHover(id),
    [setHover],
  );
  const onFrameLeave = useCallback(() => setHover(null), [setHover]);

  const vp = viewport;
  const cursor =
    spaceDown || gestureRef.current?.mode === 'pan'
      ? 'grab'
      : gestureRef.current?.mode === 'marquee'
        ? 'crosshair'
        : 'default';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="absolute"
        style={{
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: '0 0',
          width: STAGE_W_PX,
          height: STAGE_H_PX,
        }}
      >
        {/* 16:9 stage */}
        <div
          className="absolute inset-0 bg-[#0b0d10]"
          style={{
            backgroundImage:
              doc.settings.background === 'custom' && bgUrl
                ? `url("${bgUrl}")`
                : doc.settings.background === 'plain'
                  ? undefined
                  : stagePattern,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 0 0 1px #000, 0 8px 40px rgba(0,0,0,0.6)',
          }}
        />        {/* 4:3 safe area */}
        {showSafeArea && (
          <div
            className="absolute border border-dashed border-[#3f5f8a]"
            style={{
              left: GAME_AREA_PX.x,
              top: GAME_AREA_PX.y,
              width: GAME_AREA_PX.w,
              height: GAME_AREA_PX.h,
            }}
          >
            <span className="absolute -top-4 left-0 text-[10px] text-[#5f7faa]">
              0.8 × 0.6 游戏区
            </span>
          </div>
        )}
        {/* grid inside game area */}
        {showGrid && (
          <div
            className="absolute"
            style={{
              left: GAME_AREA_PX.x,
              top: GAME_AREA_PX.y,
              width: GAME_AREA_PX.w,
              height: GAME_AREA_PX.h,
              backgroundImage:
                'linear-gradient(to right, rgba(120,140,170,0.13) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(120,140,170,0.13) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
        )}

        {/* frames — flat layer, DFS order = z order */}
        {renderIds.map((id) => {
          if (id === doc.rootId) return null;
          const s: SolvedFrame | undefined = solved.get(id);
          if (!s) return null;
          const p = unitsToPx(s.abs);
          return (
            <FrameView
              key={id}
              node={s.node}
              projectName={doc.name}
              x={p.x}
              y={p.y}
              w={p.w}
              h={p.h}
              onPointerEnter={() => onFrameEnter(id)}
              onPointerLeave={onFrameLeave}
            />
          );
        })}

        <SelectionOverlay solved={solved} zoom={viewport.zoom} />
      </div>

      {/* marquee (container space) */}
      {marquee && marquee.w > 1 && marquee.h > 1 && (
        <div
          className="pointer-events-none absolute border border-[var(--ed-accent)] bg-[var(--ed-accent)]/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {/* floating zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-[var(--ed-border)] bg-[var(--ed-panel)]/90 px-1 py-1 backdrop-blur">
        <button className="ed-btn icon" title="缩小" onClick={() => zoomCenter(1 / 1.2)}>
          −
        </button>
        <button
          className="ed-btn icon w-14"
          title="缩放重置为 100%"
          onClick={() => zoomCenter(1 / viewport.zoom)}
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button className="ed-btn icon" title="放大" onClick={() => zoomCenter(1.2)}>
          +
        </button>
        <button className="ed-btn icon" title="适应窗口 (F)" onClick={() => fitView()}>
          适应
        </button>
      </div>
    </div>
  );
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Default stage backdrop: dark radial vignette. */
const stagePattern =
  'radial-gradient(ellipse at 50% 45%, #1c2027 0%, #0b0d10 75%)';
