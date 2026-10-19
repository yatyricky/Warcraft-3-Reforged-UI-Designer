import { useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { solveAll } from '../../core/layout/solve';
import { applyAnchorPreset } from '../../core/layout/transform';
import { nameError } from '../../core/validate';
import { TYPE_LABELS } from '../../core/defaults';
import type { FrameNode, TextAlignH, TextAlignV, Vec2 } from '../../core/types';
import { assetRefToName, pickAndStoreImage } from '../../persistence/assetDir';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { CheckField, NumberField, Row, TextField, Vec2Field } from '../fields';

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);

  const nodes = selection
    .map((id) => doc.frames[id])
    .filter((n): n is FrameNode => Boolean(n) && n.id !== doc.rootId);

  if (nodes.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--ed-text-dim)]">
        未选中元素。点击画布或层级树中的元素进行编辑。
      </div>
    );
  }

  if (nodes.length > 1) {
    return (
      <div className="space-y-3 p-3 text-xs">
        <div className="ed-section-title">已选中 {nodes.length} 个元素</div>
        <MultiFlags />
        <div className="text-[var(--ed-text-dim)]">多选时仅支持批量移动、对齐标志与删除。</div>
      </div>
    );
  }

  const node = nodes[0];
  return (
    <div className="space-y-2 p-2">
      <FrameSection node={node} />
      <RectTransformSection node={node} />
      <TypePropsSection node={node} />
      <EventsSection node={node} />
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <div className="rounded border border-[var(--ed-border)] bg-[var(--ed-panel-2)]">
      <button
        className="flex w-full items-center justify-between px-2 py-1.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="ed-section-title">{props.title}</span>
        <span className="text-[9px] text-[var(--ed-text-dim)]">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="space-y-1 border-t border-[var(--ed-border)] px-2 py-1.5">{props.children}</div>}
    </div>
  );
}

function FrameSection({ node }: { node: FrameNode }) {
  const doc = useEditor((s) => s.doc);
  const setFrameName = useEditor((s) => s.setFrameName);
  const setFlags = useEditor((s) => s.setFlags);
  const err = nameError(doc, node.id, node.name);

  return (
    <Section title="Frame">
      <Row label="名称" hint={err ?? undefined}>
        <TextField value={node.name} onCommit={(v) => setFrameName(node.id, v)} error={err} mono />
      </Row>
      {err && <div className="pl-[104px] text-[10px] text-[#c25b5b]">{err}</div>}
      <Row label="类型">
        <span className="text-xs">{TYPE_LABELS[node.type]}（{node.type}）</span>
      </Row>
      <Row label="标志">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <CheckField
            label="激活"
            checked={node.active}
            onChange={(v) => setFlags(node.id, { active: v })}
            hint="对应 GameObject.SetActive / activeInHierarchy"
          />
          <CheckField
            label="可见"
            checked={node.visible}
            onChange={(v) => setFlags(node.id, { visible: v })}
            hint="对应 BlzFrameSetVisible"
          />
          <CheckField
            label="接受鼠标"
            checked={node.raycastTarget}
            onChange={(v) => setFlags(node.id, { raycastTarget: v })}
            hint="对应 BlzFrameSetEnable；容器一般保持关闭以免抢事件"
          />
        </div>
      </Row>
    </Section>
  );
}

const PRESETS: Array<{ min: Vec2; max: Vec2; title: string }> = [];
for (const ay of [1, 0.5, 0, -1] as const) {
  for (const ax of [0, 0.5, 1, -1] as const) {
    const min = { x: ax === -1 ? 0 : ax, y: ay === -1 ? 0 : ay };
    const max = { x: ax === -1 ? 1 : ax, y: ay === -1 ? 1 : ay };
    PRESETS.push({ min, max, title: `${min.x},${min.y} - ${max.x},${max.y}` });
  }
}

function RectTransformSection({ node }: { node: FrameNode }) {
  const doc = useEditor((s) => s.doc);
  const updateLayout = useEditor((s) => s.updateLayout);
  const solved = solveAll(doc).get(node.id);
  const parent = node.parentId ? doc.frames[node.parentId] : null;
  const parentSolved = node.parentId ? solveAll(doc).get(node.parentId) : null;
  const pw = parentSolved ? parentSolved.abs.right - parentSolved.abs.left : 0.8;
  const ph = parentSolved ? parentSolved.abs.top - parentSolved.abs.bottom : 0.6;
  const point = node.layout.anchorMin.x === node.layout.anchorMax.x && node.layout.anchorMin.y === node.layout.anchorMax.y;

  const applyPreset = (min: Vec2, max: Vec2) => {
    if (!solved) return;
    const layout = applyAnchorPreset(node.layout, solved.rel, pw, ph, min, max);
    updateLayout(node.id, layout);
  };

  return (
    <Section title="Rect Transform">
      <Row label="锚点预设">
        <PresetGrid onPick={applyPreset} current={{ min: node.layout.anchorMin, max: node.layout.anchorMax }} />
      </Row>
      <Row label="Anchor Min">
        <Vec2Field value={node.layout.anchorMin} onCommit={(v) => updateLayout(node.id, { anchorMin: v })} />
      </Row>
      <Row label="Anchor Max">
        <Vec2Field value={node.layout.anchorMax} onCommit={(v) => updateLayout(node.id, { anchorMax: v })} />
      </Row>
      <Row label="位置" hint="pivot 相对锚点参考点的偏移（war3 单位，y 向上）">
        <Vec2Field value={node.layout.anchoredPosition} onCommit={(v) => updateLayout(node.id, { anchoredPosition: v })} />
      </Row>
      <Row label={point ? '尺寸' : '尺寸增量'} hint={point ? '实际宽高' : '相对锚区宽高的增量（拉伸锚）'}>
        <Vec2Field value={node.layout.sizeDelta} onCommit={(v) => updateLayout(node.id, { sizeDelta: v })} />
      </Row>
      <Row label="Pivot">
        <Vec2Field value={node.layout.pivot} onCommit={(v) => updateLayout(node.id, { pivot: v })} />
      </Row>
      <Row label="父">
        <span className="text-xs">{parent ? parent.name : '—'}</span>
      </Row>
      {solved && (
        <Row label="解算矩形" hint="游戏区坐标（0.8×0.6，原点左下）">
          <span className="font-mono text-[10px] leading-4 text-[var(--ed-text-dim)]">
            x {solved.abs.left.toFixed(3)} · y {solved.abs.bottom.toFixed(3)} · w{' '}
            {(solved.abs.right - solved.abs.left).toFixed(3)} · h{' '}
            {(solved.abs.top - solved.abs.bottom).toFixed(3)}
          </span>
        </Row>
      )}
    </Section>
  );
}

function PresetGrid(props: {
  onPick: (min: Vec2, max: Vec2) => void;
  current: { min: Vec2; max: Vec2 };
}) {
  return (
    <div className="grid w-[72px] grid-cols-4 gap-px overflow-hidden rounded border border-[var(--ed-border)]">
      {PRESETS.map((p, i) => {
        const active =
          props.current.min.x === p.min.x &&
          props.current.min.y === p.min.y &&
          props.current.max.x === p.max.x &&
          props.current.max.y === p.max.y;
        return (
          <button
            key={i}
            title={p.title}
            className={`relative h-[18px] w-[18px] bg-[#1a1c1f] hover:bg-[#3a3226] ${active ? 'bg-[#5a4a28]' : ''}`}
            onClick={() => props.onPick(p.min, p.max)}
          >
            {/* glyph: square = point anchor, arrows = stretch */}
            <span className="absolute inset-0 flex items-center justify-center text-[9px] text-[#9aa]">
              {glyph(p.min, p.max)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function glyph(min: Vec2, max: Vec2): string {
  const sx = min.x !== max.x;
  const sy = min.y !== max.y;
  if (sx && sy) return '⊕';
  if (sx) return '↔';
  if (sy) return '↕';
  const col = min.x === 0 ? 'left' : min.x === 0.5 ? 'center' : 'right';
  const row = min.y === 0 ? 'bottom' : min.y === 0.5 ? 'center' : 'top';
  if (col === 'center' && row === 'center') return '·';
  if (col === 'left') return row === 'top' ? '◤' : row === 'bottom' ? '◣' : '◇';
  if (col === 'right') return row === 'top' ? '◥' : row === 'bottom' ? '◢' : '◇';
  return row === 'top' ? '△' : '▽';
}

function TypePropsSection({ node }: { node: FrameNode }) {
  const setProps = useEditor((s) => s.setProps);
  const docName = useEditor((s) => s.doc.name);
  const colorTouched = useRef(false);
  const p = node.props;
  const previewUrl = useAssetUrl(p.texturePreviewPath, docName);
  const hasTexture = node.type !== 'FRAME' && node.type !== 'TEXT';
  const hasText = ['TEXT', 'BUTTON', 'EDITBOX', 'TEXTAREA', 'CHECKBOX', 'STATUSBAR'].includes(node.type);
  const title =
    node.type === 'IMAGE' ? '贴图' : node.type === 'TEXT' ? '文本' : `${TYPE_LABELS[node.type]}属性`;

  return (
    <Section title={title}>
      {hasTexture && (
        <>
          <Row label="贴图路径" hint="war3 资源路径，不带扩展名，如 ReplaceableTextures\TeamColor\TeamColor08">
            <TextField value={p.texture} onCommit={(v) => setProps(node.id, { texture: v })} mono />
          </Row>
          <Row
            label="预览图"
            hint="选一张本地图片，复制到 ~/.tmp/W3RUID/<工程名>/ 供编辑器预览（PNG/JPG/WebP）；首次落盘前会请求一次目录授权"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                className="ed-btn shrink-0"
                onClick={() => {
                  void pickAndStoreImage(docName, 'texture').then((stored) => {
                    if (stored) setProps(node.id, { texturePreviewPath: stored });
                  });
                }}
              >
                选择…
              </button>
              {p.texturePreviewPath && (
                <>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-6 w-6 rounded border border-[var(--ed-border)] object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--ed-text-dim)]" title={p.texturePreviewPath}>
                    {assetRefToName(p.texturePreviewPath) ?? '会话内预览（未落盘）'}
                  </span>
                  <button className="ed-btn shrink-0" onClick={() => setProps(node.id, { texturePreviewPath: '' })}>
                    ×
                  </button>
                </>
              )}
            </div>
          </Row>
        </>
      )}
      {hasText && (
        <Row label="文本">
          <TextField value={p.text} onCommit={(v) => setProps(node.id, { text: v })} />
        </Row>
      )}
      {(hasText || node.type === 'IMAGE') && (
        <Row label="颜色">
          <input
            type="color"
            className="ed-color"
            value={p.color}
            onChange={(e) => {
              // one undo step per picker interaction: history on first tick only
              setProps(node.id, { color: e.target.value }, !colorTouched.current);
              colorTouched.current = true;
            }}
            onBlur={() => {
              colorTouched.current = false;
            }}
          />
        </Row>
      )}
      {node.type === 'TEXT' && (
        <>
          <Row label="字号缩放">
            <NumberField value={p.textScale} step={0.1} min={0.1} onCommit={(v) => setProps(node.id, { textScale: v })} />
          </Row>
          <Row label="水平对齐">
            <select
              className="ed-input"
              value={p.textHorAlign}
              onChange={(e) => setProps(node.id, { textHorAlign: e.target.value as TextAlignH })}
            >
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </Row>
          <Row label="垂直对齐">
            <select
              className="ed-input"
              value={p.textVerAlign}
              onChange={(e) => setProps(node.id, { textVerAlign: e.target.value as TextAlignV })}
            >
              <option value="top">上</option>
              <option value="middle">中</option>
              <option value="bottom">下</option>
            </select>
          </Row>
        </>
      )}
      {node.type === 'STATUSBAR' && (
        <Row label="值 (0-100)">
          <NumberField value={p.value} step={1} min={0} max={100} onCommit={(v) => setProps(node.id, { value: v })} />
        </Row>
      )}
      {node.type === 'SLIDER' && (
        <>
          <Row label="最小值">
            <NumberField value={p.min} step={1} onCommit={(v) => setProps(node.id, { min: v })} />
          </Row>
          <Row label="最大值">
            <NumberField value={p.max} step={1} onCommit={(v) => setProps(node.id, { max: v })} />
          </Row>
          <Row label="当前值">
            <NumberField value={p.value} step={1} onCommit={(v) => setProps(node.id, { value: v })} />
          </Row>
        </>
      )}
    </Section>
  );
}

function EventsSection({ node }: { node: FrameNode }) {
  const setProps = useEditor((s) => s.setProps);
  const p = node.props;
  const interactive = ['BUTTON', 'CHECKBOX', 'EDITBOX', 'SLIDER', 'IMAGE', 'FRAME', 'TEXTAREA'].includes(node.type);
  if (!interactive) return null;
  return (
    <Section title="事件（供 v2 导出）" defaultOpen={false}>
      <Row label="触发器变量" hint="如 udg_xxx">
        <TextField value={p.trigVar} onCommit={(v) => setProps(node.id, { trigVar: v })} mono />
      </Row>
      <Row label="OnClick">
        <TextField value={p.onClickFunc} onCommit={(v) => setProps(node.id, { onClickFunc: v })} mono />
      </Row>
      <Row label="OnMouseEnter">
        <TextField value={p.onMouseEnterFunc} onCommit={(v) => setProps(node.id, { onMouseEnterFunc: v })} mono />
      </Row>
      <Row label="OnMouseLeave">
        <TextField value={p.onMouseLeaveFunc} onCommit={(v) => setProps(node.id, { onMouseLeaveFunc: v })} mono />
      </Row>
    </Section>
  );
}

function MultiFlags() {
  const selection = useEditor((s) => s.selection);
  const setFlags = useEditor((s) => s.setFlags);
  const doc = useEditor((s) => s.doc);
  const nodes = selection.map((id) => doc.frames[id]).filter((n): n is FrameNode => Boolean(n));
  const all = (k: 'active' | 'visible' | 'raycastTarget') => nodes.every((n) => n[k]);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <CheckField label="激活" checked={all('active')} onChange={(v) => nodes.forEach((n) => setFlags(n.id, { active: v }))} />
      <CheckField label="可见" checked={all('visible')} onChange={(v) => nodes.forEach((n) => setFlags(n.id, { visible: v }))} />
      <CheckField label="接受鼠标" checked={all('raycastTarget')} onChange={(v) => nodes.forEach((n) => setFlags(n.id, { raycastTarget: v }))} />
    </div>
  );
}
