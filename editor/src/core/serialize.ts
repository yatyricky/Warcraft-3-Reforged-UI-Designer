import { defaultLayout, defaultProps, makeRoot, newProject } from './defaults';
import { newId } from './ids';
import type {
  FrameNode,
  FrameProps,
  FrameType,
  Layout,
  ProjectDoc,
  TextAlignH,
  TextAlignV,
} from './types';
import { FRAME_TYPES } from './types';

interface SerializedFrame {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  active?: unknown;
  visible?: unknown;
  raycastTarget?: unknown;
  layout?: unknown;
  props?: unknown;
  children?: unknown;
}

interface SerializedProject {
  schemaVersion?: unknown;
  name?: unknown;
  libraryName?: unknown;
  settings?: unknown;
  root?: unknown;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function loadLayout(v: unknown): Layout {
  const d = defaultLayout();
  if (!v || typeof v !== 'object') return d;
  const raw = v as Record<string, unknown>;
  const vec = (key: string, fb: { x: number; y: number }) => {
    const o = raw[key];
    if (!o || typeof o !== 'object') return fb;
    const t = o as Record<string, unknown>;
    return { x: num(t.x, fb.x), y: num(t.y, fb.y) };
  };
  return {
    anchorMin: vec('anchorMin', d.anchorMin),
    anchorMax: vec('anchorMax', d.anchorMax),
    anchoredPosition: vec('anchoredPosition', d.anchoredPosition),
    sizeDelta: vec('sizeDelta', d.sizeDelta),
    pivot: vec('pivot', d.pivot),
  };
}

const H_ALIGNS: readonly TextAlignH[] = ['left', 'center', 'right'];
const V_ALIGNS: readonly TextAlignV[] = ['top', 'middle', 'bottom'];

function loadProps(v: unknown): FrameProps {
  const d = defaultProps();
  if (!v || typeof v !== 'object') return d;
  const raw = v as Record<string, unknown>;
  const hor = str(raw.textHorAlign, d.textHorAlign) as TextAlignH;
  const ver = str(raw.textVerAlign, d.textVerAlign) as TextAlignV;
  return {
    texture: str(raw.texture),
    texturePreviewPath: str(raw.texturePreviewPath),
    text: str(raw.text),
    color: str(raw.color, d.color),
    textScale: num(raw.textScale, d.textScale),
    textHorAlign: H_ALIGNS.includes(hor) ? hor : d.textHorAlign,
    textVerAlign: V_ALIGNS.includes(ver) ? ver : d.textVerAlign,
    value: num(raw.value, d.value),
    min: num(raw.min, d.min),
    max: num(raw.max, d.max),
    trigVar: str(raw.trigVar),
    onClickFunc: str(raw.onClickFunc),
    onMouseEnterFunc: str(raw.onMouseEnterFunc),
    onMouseLeaveFunc: str(raw.onMouseLeaveFunc),
  };
}

interface LoadCtx {
  frames: Record<string, FrameNode>;
  usedIds: Set<string>;
}

function loadFrame(raw: SerializedFrame, parentId: string | null, ctx: LoadCtx): FrameNode | null {
  const type = FRAME_TYPES.includes(raw.type as FrameType) ? (raw.type as FrameType) : 'FRAME';
  let id = str(raw.id);
  if (!id || ctx.usedIds.has(id)) id = newId();
  ctx.usedIds.add(id);
  const node: FrameNode = {
    id,
    name: str(raw.name, 'Frame'),
    type,
    active: bool(raw.active, true),
    visible: bool(raw.visible, true),
    raycastTarget: bool(raw.raycastTarget, type !== 'FRAME' && type !== 'TEXT'),
    layout: loadLayout(raw.layout),
    props: loadProps(raw.props),
    childIds: [],
    parentId,
  };
  ctx.frames[id] = node;
  if (Array.isArray(raw.children)) {
    for (const child of raw.children) {
      if (child && typeof child === 'object') {
        const c = loadFrame(child as SerializedFrame, id, ctx);
        if (c) node.childIds.push(c.id);
      }
    }
  }
  return node;
}

/** Defensive load: unknown fields ignored, bad values fall back to defaults. */
export function loadProjectJson(json: string): ProjectDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return newProject();
  }
  return loadProject(raw);
}

export function loadProject(raw: unknown): ProjectDoc {
  const doc = newProject();
  if (!raw || typeof raw !== 'object') return doc;
  const proj = raw as SerializedProject;
  doc.name = str(proj.name, doc.name);
  doc.libraryName = str(proj.libraryName, doc.libraryName);
  if (proj.settings && typeof proj.settings === 'object') {
    const s = proj.settings as Record<string, unknown>;
    doc.settings.background =
      s.background === 'plain' || s.background === 'custom' ? s.background : 'default';
    doc.settings.backgroundImage = str(s.backgroundImage);
    doc.settings.showSafeArea = bool(s.showSafeArea, true);
    doc.settings.showGrid = bool(s.showGrid, false);
  }
  if (!proj.root || typeof proj.root !== 'object') return doc;

  const ctx: LoadCtx = { frames: {}, usedIds: new Set() };
  const rootRaw = proj.root as SerializedFrame;
  // The synthetic root is regenerated; its children become top-level frames.
  const root = makeRoot();
  ctx.frames[root.id] = root;
  ctx.usedIds.add(root.id);
  if (Array.isArray(rootRaw.children)) {
    for (const child of rootRaw.children) {
      if (child && typeof child === 'object') {
        const c = loadFrame(child as SerializedFrame, root.id, ctx);
        if (c) root.childIds.push(c.id);
      }
    }
  }
  // one-off root: if the saved root itself carries layout/props beyond children, ignore (v1 root is fixed)

  // enforce name uniqueness (case-insensitive), keep first occurrence
  const seen = new Map<string, string>();
  for (const node of Object.values(ctx.frames)) {
    if (node.id === root.id) continue;
    const key = node.name.toLowerCase();
    if (seen.has(key)) {
      let i = 2;
      while (seen.has(`${node.name}${i}`.toLowerCase())) i += 1;
      node.name = `${node.name}${i}`;
    }
    seen.set(node.name.toLowerCase(), node.id);
  }
  doc.frames = ctx.frames;
  return doc;
}

interface SaveFrame {
  name: string;
  type: FrameType;
  active: boolean;
  visible: boolean;
  raycastTarget: boolean;
  layout: Layout;
  props: FrameProps;
  children: SaveFrame[];
}

function saveFrame(node: FrameNode, doc: ProjectDoc): SaveFrame {
  return {
    name: node.name,
    type: node.type,
    active: node.active,
    visible: node.visible,
    raycastTarget: node.raycastTarget,
    layout: node.layout,
    props: node.props,
    children: node.childIds
      .map((id) => doc.frames[id])
      .filter((n): n is FrameNode => Boolean(n))
      .map((n) => saveFrame(n, doc)),
  };
}

export function saveProjectJson(doc: ProjectDoc): string {
  const root = doc.frames[doc.rootId];
  const payload = {
    schemaVersion: 1,
    name: doc.name,
    libraryName: doc.libraryName,
    settings: doc.settings,
    root: root ? saveFrame(root, doc) : null,
  };
  return JSON.stringify(payload, null, 2);
}
