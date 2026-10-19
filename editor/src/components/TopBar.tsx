import { useEditor } from '../store/editorStore';
import { isDirty, newProjectOp, openOp, saveAsOp, saveOp } from '../persistence/fileOps';
import { saveAuto } from '../persistence/autosave';
import { saveProjectJson } from '../core/serialize';
import { pickAndStoreImage } from '../persistence/assetDir';
import type { BackgroundVariant } from '../core/types';
import { useEffect, useRef } from 'react';
import { TextField } from './fields';

export function TopBar() {
  const docName = useEditor((s) => s.doc.name);
  const libraryName = useEditor((s) => s.doc.libraryName);
  const settings = useEditor((s) => s.doc.settings);
  const setProjectMeta = useEditor((s) => s.setProjectMeta);
  const setSettings = useEditor((s) => s.setSettings);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const doc = useEditor((s) => s.doc);
  const fileName = useEditor((s) => s.fileName);

  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty();

  // debounced autosave — only after real user edits (past > 0), so a bare
  // page load never clobbers an existing snapshot with the initial document
  useEffect(() => {
    const t = setTimeout(() => {
      const s = useEditor.getState();
      if (s.past.length > 0) saveAuto(saveProjectJson(s.doc));
    }, 800);
    return () => clearTimeout(t);
  }, [doc]);

  const onBackgroundChange = async (v: BackgroundVariant) => {
    if (v !== 'custom') {
      setSettings({ background: v });
      return;
    }
    // switching to custom with an image already stored: just switch;
    // otherwise (or re-picking while already custom) open the file input
    if (settings.background === 'custom' || !settings.backgroundImage) {
      const stored = await pickAndStoreImage(doc.name, 'background');
      if (!stored) return; // cancelled — controlled select snaps back
      setSettings({ background: 'custom', backgroundImage: stored });
      return;
    }
    setSettings({ background: 'custom' });
  };

  return (
    <header className="ed-panel flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-xs">
      <span className="font-semibold tracking-wide text-[var(--ed-accent)]">WC3 UI Editor</span>

      <div className="flex items-center gap-1">
        <span className="text-[var(--ed-text-dim)]">工程</span>
        <div className="w-36">
          <TextField value={docName} onCommit={(v) => setProjectMeta({ name: v })} />
        </div>
        <span className="text-[var(--ed-text-dim)]" title="导出 JASS 库名（v2 使用）">
          库
        </span>
        <div className="w-24">
          <TextField value={libraryName} onCommit={(v) => setProjectMeta({ libraryName: v })} mono />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="ed-btn" onClick={() => void newProjectOp()}>
          新建
        </button>
        <button className="ed-btn" onClick={() => void openOp()}>
          打开
        </button>
        <button className="ed-btn" onClick={() => void saveOp()} title="Ctrl+S">
          保存
        </button>
        <button className="ed-btn" onClick={() => void saveAsOp()} title="Ctrl+Shift+S">
          另存为
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button className="ed-btn icon" onClick={undo} disabled={past === 0} title="撤销 (Ctrl+Z)">
          ↶
        </button>
        <button
          className="ed-btn icon"
          onClick={redo}
          disabled={future === 0}
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      <div className="flex items-center gap-1">
        <select
          className="ed-input"
          value={settings.background}
          onChange={(e) => void onBackgroundChange(e.target.value as BackgroundVariant)}
          title="舞台背景"
        >
          <option value="default">深色背景</option>
          <option value="plain">纯黑背景</option>
          <option value="custom">自定义图片…</option>
        </select>
        {settings.background === 'custom' && (
          <>
            <button
              className="ed-btn icon"
              title="更换背景图片（存入 ~/.tmp/W3RUID/<工程名>/）"
              onClick={() => {
                void pickAndStoreImage(doc.name, 'background').then((stored) => {
                  if (stored) setSettings({ backgroundImage: stored });
                });
              }}
            >
              更换图片
            </button>
            <button
              className="ed-btn icon"
              title="清除自定义背景"
              onClick={() => setSettings({ background: 'default', backgroundImage: '' })}
            >
              ×
            </button>
          </>
        )}
        <label className="flex cursor-pointer items-center gap-1" title="显示 4:3 安全区 / 0.8×0.6 游戏区">
          <input
            type="checkbox"
            className="ed-check"
            checked={settings.showSafeArea}
            onChange={(e) => setSettings({ showSafeArea: e.target.checked })}
          />
          安全区
        </label>
        <label className="flex cursor-pointer items-center gap-1" title="显示网格并在拖拽时吸附">
          <input
            type="checkbox"
            className="ed-check"
            checked={settings.showGrid}
            onChange={(e) => setSettings({ showGrid: e.target.checked })}
          />
          网格
        </label>
      </div>

      <span className="ml-auto text-[var(--ed-text-dim)]">
        {fileName ?? '未保存过'}
        {dirtyRef.current && <span className="ml-1 text-[var(--ed-accent)]">●未保存</span>}
      </span>
    </header>
  );
}
