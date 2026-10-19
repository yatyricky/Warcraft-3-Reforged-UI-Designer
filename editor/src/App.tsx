import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Hierarchy } from './components/Hierarchy';
import { Canvas } from './components/canvas/Canvas';
import { Inspector } from './components/inspector/Inspector';
import { useKeyboard } from './hooks/useKeyboard';
import { useEditor } from './store/editorStore';
import { loadAuto, clearAuto } from './persistence/autosave';
import { loadProjectJson } from './core/serialize';

function RestoreBanner({ onDone }: { onDone: () => void }) {
  const loadDoc = useEditor((s) => s.loadDoc);
  const [info] = useState(() => loadAuto());
  if (!info) return null;
  return (
    <div className="flex items-center gap-2 border-b border-[var(--ed-border)] bg-[#2b2417] px-3 py-1.5 text-xs">
      <span>检测到自动暂存（{new Date(info.time).toLocaleString('zh-CN')}）。</span>
      <button
        className="ed-btn"
        onClick={() => {
          loadDoc(loadProjectJson(info.json), null);
          clearAuto();
          onDone();
        }}
      >
        恢复
      </button>
      <button
        className="ed-btn"
        onClick={() => {
          clearAuto();
          onDone();
        }}
      >
        丢弃
      </button>
    </div>
  );
}

export default function App() {
  useKeyboard();
  const [restoreChecked, setRestoreChecked] = useState(false);
  useEffect(() => setRestoreChecked(true), []);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {restoreChecked && <RestoreBanner onDone={() => setRestoreChecked(false)} />}
      <div className="flex min-h-0 flex-1">
        <aside className="ed-panel ed-scroll w-60 shrink-0 overflow-y-auto border-r">
          <Hierarchy />
        </aside>
        <main className="ed-canvas-container min-w-0 flex-1">
          <Canvas />
        </main>
        <aside className="ed-panel ed-scroll w-72 shrink-0 overflow-y-auto border-l">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
