/**
 * Core data model.
 *
 * Layout semantics mirror the authoring surface of Zulaman-WE's FrameComponent
 * (uGUI RectTransform style): anchorMin/anchorMax + anchoredPosition + sizeDelta
 * + pivot, all in war3 frame units where the full-screen game area is 0.8 wide
 * × 0.6 tall, y-up, origin bottom-left.
 */

export type FrameType =
  | 'FRAME'
  | 'IMAGE'
  | 'TEXT'
  | 'BUTTON'
  | 'CHECKBOX'
  | 'STATUSBAR'
  | 'SLIDER'
  | 'EDITBOX'
  | 'TEXTAREA';

export const FRAME_TYPES: readonly FrameType[] = [
  'FRAME',
  'IMAGE',
  'TEXT',
  'BUTTON',
  'CHECKBOX',
  'STATUSBAR',
  'SLIDER',
  'EDITBOX',
  'TEXTAREA',
];

export interface Vec2 {
  x: number;
  y: number;
}

export interface Layout {
  /** Lower-left anchor, relative to parent rect (0..1 typical). */
  anchorMin: Vec2;
  /** Upper-right anchor; equal to anchorMin for a point anchor. */
  anchorMax: Vec2;
  /**
   * Pivot position relative to the anchor reference point
   * (the anchor itself when point-anchored, the anchor area center when stretched).
   */
  anchoredPosition: Vec2;
  /**
   * Point anchor: actual width/height.
   * Stretch anchor: width minus distance between anchors (Unity sizeDelta rule).
   */
  sizeDelta: Vec2;
  /** Pivot within the rect, 0..1. */
  pivot: Vec2;
}

export type TextAlignH = 'left' | 'center' | 'right';
export type TextAlignV = 'top' | 'middle' | 'bottom';

/**
 * Type-specific properties. All frame nodes carry the full bag (defaults for
 * unused fields); editors only surface the fields relevant to the node type.
 * Kept as one flat bag so v2 export can read any of it without model surgery.
 */
export interface FrameProps {
  /** war3 texture path, no extension, e.g. ReplaceableTextures\TeamColor\TeamColor08. */
  texture: string;
  /** Local disk path (or object URL) used only for editor preview. */
  texturePreviewPath: string;
  text: string;
  color: string;
  /** Text scale factor. */
  textScale: number;
  textHorAlign: TextAlignH;
  textVerAlign: TextAlignV;
  /** STATUSBAR fill 0..100. */
  value: number;
  /** SLIDER range. */
  min: number;
  max: number;
  /** Reserved for v2 export: trigger variable name (udg_). */
  trigVar: string;
  onClickFunc: string;
  onMouseEnterFunc: string;
  onMouseLeaveFunc: string;
}

export interface FrameNode {
  id: string;
  /** Native frame name; unique across the project; identifier-safe. */
  name: string;
  type: FrameType;
  active: boolean;
  visible: boolean;
  /** Whether the frame intercepts mouse input (Zulaman-WE raycastTarget). */
  raycastTarget: boolean;
  layout: Layout;
  props: FrameProps;
  childIds: string[];
  parentId: string | null;
}

export type BackgroundVariant = 'default' | 'plain' | 'custom';

export interface ProjectSettings {
  background: BackgroundVariant;
  /** `asset:<name>` reference (or session blob URL) used when background === 'custom'. */
  backgroundImage: string;
  showSafeArea: boolean;
  showGrid: boolean;
}

export interface ProjectDoc {
  schemaVersion: 1;
  name: string;
  libraryName: string;
  settings: ProjectSettings;
  /** Normalized tree, keyed by id; includes the synthetic root. */
  frames: Record<string, FrameNode>;
  rootId: string;
}

/** Absolute rect in parent-space units, y-up (bottom = min y). */
export interface Rect {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

/** Geometry of the war3 game area on the 1920x1080 stage, in px (y-down, top-left origin). */
export const STAGE_W_PX = 1920;
export const STAGE_H_PX = 1080;
/** The 0.8x0.6 game area maps to the central 4:3 region: 1440x1080 px. */
export const GAME_AREA_PX = { x: 240, y: 0, w: 1440, h: 1080 };
/** Stage px per war3 unit at zoom 1. */
export const PX_PER_UNIT = 1800;
/** Root frame occupies the whole game area. */
export const ROOT_SIZE = { w: 0.8, h: 0.6 };
