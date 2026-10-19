import { useMemo, useState } from 'react';
import { useEditor, type DropMode } from '../store/editorStore';
import { nameError } from '../core/validate';
import { TYPE_LABELS } from '../core/defaults';
import type { FrameNode, FrameType } from '../core/types';
import { FRAME_TYPES } from '../core/types';

/**
 * Hierarchy tree: drag to reorder/reparent (top 1/3 = before, bottom 1/3 =
 * after, middle = into), eye toggles visibility, ⏻ toggles active,
 * double-click renames. Selection is shared with the canvas.
 */

interface DragInfo {
  id: string;
}

export function Hierarchy() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const reparent = useEditor((s) => s.reparent);
  const setFlags = useEditor((s) => s.setFlags);
  const addFrame = useEditor((s) => s.addFrame);
  const removeFrames = useEditor((s) => s.removeFrames);
  const duplicateFrames = useEditor((s) => s.duplicateFrames);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; mode: DropMode } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newType, setNewType] = useState<FrameType>('FRAME');

  const rows = useMemo(() => {
    const out: Array<{ node: FrameNode; depth: number }> = [];
    const walk = (id: string, depth: number) => {
      const node = doc.frames[id];
      if (!node) return;
      out.push({ node, depth });
      if (!collapsed.has(id)) for (const c of node.childIds) walk(c, depth + 1);
    };
    walk(doc.rootId, 0);
    return out;
  }, [doc, collapsed]);

  const canDrop = (targetId: string, mode: DropMode): boolean => {
    if (!drag) return false;
    if (mode === 'into') {
      if (drag.id === targetId) return false;
      let cur = doc.frames[targetId]?.parentId ?? null;
      while (cur !== null) {
        if (cur === drag.id) return false;
        cur = doc.frames[cur]?.parentId ?? null;
      }
      return true;
    }
    // before/after: target must have a parent (i.e. not the root row)
    const parentId = doc.frames[targetId]?.parentId;
    if (parentId === null || parentId === undefined) return false;
    let cur: string | null = parentId;
    while (cur !== null) {
      if (cur === drag.id) return false;
      cur = doc.frames[cur]?.parentId ?? null;
    }
    return true;
  };

  const zoneFromEvent = (e: React.DragEvent, isRoot: boolean): DropMode => {
    if (isRoot) return 'into';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = (e.clientY - rect.top) / rect.height;
    if (t < 0.28) return 'before';
    if (t > 0.72) return 'after';
    return 'into';
  };

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center justify-between gap-1 border-b border-[var(--ed-border)] px-2 py-1.5">
        <span className="ed-section-title">层级</span>
        <div className="flex min-w-0 items-center gap-1">
          <select
            className="ed-input min-w-0 flex-1"
            value={newType}
            title="新元素类型（添加到当前选中元素内部，未选中时添加到根）"
            onChange={(e) => setNewType(e.target.value as FrameType)}
          >
            {FRAME_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            className="ed-btn icon shrink-0"
            title={`添加${TYPE_LABELS[newType]}`}
            onClick={() => {
              const parent = selection.length > 0 ? selection[selection.length - 1] : undefined;
              addFrame(newType, parent);
            }}
          >
            ＋
          </button>
        </div>
      </div>

      <div
        className="ed-scroll min-h-0 flex-1 overflow-y-auto py-1"
        onDragEnd={() => {
          setDrag(null);
          setDropTarget(null);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {rows.map(({ node, depth }) => {
          const isRoot = node.id === doc.rootId;
          const selected = selection.includes(node.id);
          const hasChildren = node.childIds.length > 0;
          const isCollapsed = collapsed.has(node.id);
          const dt = dropTarget?.id === node.id ? dropTarget.mode : null;
          return (
            <div
              key={node.id}
              draggable={!renaming}
              onDragStart={(e) => {
                if (isRoot) return;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', node.id);
                setDrag({ id: node.id });
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                e.stopPropagation();
                const mode = zoneFromEvent(e, isRoot);
                if (canDrop(node.id, mode)) setDropTarget({ id: node.id, mode });
                else setDropTarget(null);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                setDropTarget((cur) => (cur?.id === node.id ? null : cur));
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const mode = zoneFromEvent(e, isRoot);
                if (drag && canDrop(node.id, mode)) {
                  const moving = selection.includes(drag.id) ? selection : [drag.id];
                  // move multiple: primary relative to target; others follow in order
                  if (moving.length === 1) {
                    reparent(drag.id, node.id, mode);
                  } else {
                    let anchor = node.id;
                    let m: DropMode = mode;
                    for (const id of moving) {
                      if (reparent(id, anchor, m)) {
                        anchor = id;
                        m = 'after';
                      }
                    }
                  }
                }
                setDrag(null);
                setDropTarget(null);
              }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  if (!isRoot) toggleSelect(node.id);
                } else if (e.shiftKey && selection.length > 0 && !isRoot) {
                  const ids = rows.map((r) => r.node.id);
                  const last = ids.indexOf(selection[selection.length - 1]);
                  const cur = ids.indexOf(node.id);
                  const [lo, hi] = [Math.min(last, cur), Math.max(last, cur)];
                  select(ids.slice(lo, hi + 1).filter((id) => id !== doc.rootId));
                } else {
                  select([node.id]);
                }
              }}
              onDoubleClick={() => {
                if (!isRoot) setRenaming(node.id);
              }}
              className={`group relative flex cursor-pointer items-center gap-1 py-[3px] pr-1 ${
                selected ? 'bg-[#3a3226]' : 'hover:bg-[#26282d]'
              } ${dt === 'into' ? 'outline outline-1 outline-[var(--ed-accent)]' : ''} ${
                renaming === node.id ? 'bg-[#26282d]' : ''
              }`}
              style={{
                paddingLeft: 4 + depth * 14,
                boxShadow:
                  dt === 'before'
                    ? 'inset 0 2px 0 var(--ed-accent)'
                    : dt === 'after'
                      ? 'inset 0 -2px 0 var(--ed-accent)'
                      : undefined,
              }}
            >
              {/* caret */}
              <button
                className={`w-3 shrink-0 text-[9px] text-[var(--ed-text-dim)] ${
                  hasChildren ? '' : 'invisible'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((cur) => {
                    const next = new Set(cur);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>

              {/* type badge */}
              <span
                className="shrink-0 rounded px-1 text-[9px] leading-[14px]"
                style={{ background: typeColor(node.type), color: '#111' }}
              >
                {node.type.slice(0, 3)}
              </span>

              {/* name / rename input */}
              {renaming === node.id ? (
                <RenameInput
                  node={node}
                  onDone={(name) => {
                    if (name && name !== node.name && !nameError(doc, node.id, name)) {
                      useEditor.getState().setFrameName(node.id, name);
                    }
                    setRenaming(null);
                  }}
                />
              ) : (
                <span
                  className={`min-w-0 flex-1 truncate ${
                    node.active && node.visible ? '' : 'text-[var(--ed-text-dim)] line-through'
                  }`}
                >
                  {node.name}
                </span>
              )}

              {/* toggles */}
              {!isRoot && renaming !== node.id && (
                <span className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    className="text-[10px] text-[var(--ed-text-dim)] hover:text-white"
                    title={node.visible ? '隐藏' : '显示'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlags(node.id, { visible: !node.visible });
                    }}
                  >
                    {node.visible ? '👁' : '🚫'}
                  </button>
                  <button
                    className="text-[10px] text-[var(--ed-text-dim)] hover:text-white"
                    title={node.active ? '失活' : '激活'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlags(node.id, { active: !node.active });
                    }}
                  >
                    {node.active ? '⏻' : '○'}
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* footer actions */}
      <div className="flex gap-1 border-t border-[var(--ed-border)] px-2 py-1.5">
        <button
          className="ed-btn flex-1"
          disabled={selection.length === 0}
          onClick={() => duplicateFrames(selection)}
        >
          复制
        </button>
        <button
          className="ed-btn flex-1"
          disabled={selection.length === 0}
          onClick={() => removeFrames(selection)}
        >
          删除
        </button>
      </div>
    </div>
  );
}

function RenameInput({ node, onDone }: { node: FrameNode; onDone: (name: string) => void }) {
  const [value, setValue] = useState(node.name);
  return (
    <input
      autoFocus
      className="ed-input min-w-0 flex-1"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value);
        if (e.key === 'Escape') onDone('');
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function typeColor(t: FrameNode['type']): string {
  switch (t) {
    case 'FRAME': return '#8a8f98';
    case 'IMAGE': return '#6fa8dc';
    case 'TEXT': return '#e8c56a';
    case 'BUTTON': return '#b3c46a';
    case 'CHECKBOX': return '#d98cb3';
    case 'STATUSBAR': return '#7db63f';
    case 'SLIDER': return '#c9a44a';
    case 'EDITBOX': return '#8fbcd4';
    case 'TEXTAREA': return '#a4a4e0';
    default: return '#888';
  }
}
