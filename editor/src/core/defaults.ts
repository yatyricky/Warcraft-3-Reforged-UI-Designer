import { newId } from './ids';
import type { FrameNode, FrameProps, FrameType, Layout, ProjectDoc, Vec2 } from './types';
import { ROOT_SIZE } from './types';

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function defaultLayout(): Layout {
  return {
    anchorMin: vec2(0.5, 0.5),
    anchorMax: vec2(0.5, 0.5),
    anchoredPosition: vec2(0, 0),
    sizeDelta: vec2(0.2, 0.2),
    pivot: vec2(0.5, 0.5),
  };
}

export function defaultProps(): FrameProps {
  return {
    texture: '',
    texturePreviewPath: '',
    text: '',
    color: '#ffffff',
    textScale: 1,
    textHorAlign: 'center',
    textVerAlign: 'middle',
    value: 100,
    min: 0,
    max: 100,
    trigVar: '',
    onClickFunc: '',
    onMouseEnterFunc: '',
    onMouseLeaveFunc: '',
  };
}

/** Root frame: invisible container spanning the whole 0.8x0.6 game area. */
export function makeRoot(): FrameNode {
  return {
    id: 'root',
    name: 'ROOT',
    type: 'FRAME',
    active: true,
    visible: true,
    raycastTarget: false,
    layout: {
      anchorMin: vec2(0, 0),
      anchorMax: vec2(1, 1),
      anchoredPosition: vec2(0, 0),
      sizeDelta: vec2(0, 0),
      pivot: vec2(0.5, 0.5),
    },
    props: defaultProps(),
    childIds: [],
    parentId: null,
  };
}

export function makeFrame(type: FrameType, name: string, parent: FrameNode): FrameNode {
  const layout = defaultLayout();
  const props = defaultProps();
  switch (type) {
    case 'FRAME':
      layout.sizeDelta = vec2(0.2, 0.2);
      break;
    case 'IMAGE':
      layout.sizeDelta = vec2(0.1, 0.1);
      props.texture = 'ReplaceableTextures\\TeamColor\\TeamColor08';
      break;
    case 'TEXT':
      layout.sizeDelta = vec2(0.2, 0.05);
      props.text = '文本';
      props.color = '#ffcc00';
      break;
    case 'BUTTON':
      layout.sizeDelta = vec2(0.12, 0.12);
      props.texture = 'ReplaceableTextures\\CommandButtons\\BTNHeroPaladin';
      break;
    case 'CHECKBOX':
      layout.sizeDelta = vec2(0.022, 0.022);
      break;
    case 'STATUSBAR':
      layout.sizeDelta = vec2(0.25, 0.03);
      props.value = 70;
      break;
    case 'SLIDER':
      layout.sizeDelta = vec2(0.025, 0.18);
      props.min = 0;
      props.max = 100;
      props.value = 50;
      break;
    case 'EDITBOX':
      layout.sizeDelta = vec2(0.2, 0.04);
      props.text = '';
      break;
    case 'TEXTAREA':
      layout.sizeDelta = vec2(0.25, 0.15);
      props.text = '多行文本内容';
      props.textHorAlign = 'left';
      props.textVerAlign = 'top';
      break;
  }
  return {
    id: newId(),
    name,
    type,
    active: true,
    visible: true,
    raycastTarget: type !== 'FRAME' && type !== 'TEXT',
    layout,
    props,
    childIds: [],
    parentId: parent.id,
  };
}

/** Default palette of type presets offered by "新建" menus. */
export const TYPE_LABELS: Record<FrameType, string> = {
  FRAME: '容器',
  IMAGE: '贴图',
  TEXT: '文本',
  BUTTON: '按钮',
  CHECKBOX: '复选框',
  STATUSBAR: '状态条',
  SLIDER: '滑条',
  EDITBOX: '输入框',
  TEXTAREA: '文本域',
};

let nameCounter = 0;
export function _resetNameCounter(): void {
  nameCounter = 0;
}

export function nextFrameName(type: FrameType, frames: ProjectDoc['frames']): string {
  const taken = new Set<string>();
  for (const node of Object.values(frames)) taken.add(node.name.toLowerCase());
  for (;;) {
    nameCounter += 1;
    const candidate = `${type.charAt(0)}${type.slice(1).toLowerCase()}${nameCounter}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function newProject(name = '未命名工程'): ProjectDoc {
  const root = makeRoot();
  return {
    schemaVersion: 1,
    name,
    libraryName: 'MYUI',
    settings: {
      background: 'default',
      backgroundImage: '',
      showSafeArea: true,
      showGrid: false,
    },
    frames: { [root.id]: root },
    rootId: root.id,
  };
}

export { ROOT_SIZE };
