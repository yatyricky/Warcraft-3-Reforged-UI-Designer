import { useEditor } from '../store/editorStore';
import { loadProjectJson, saveProjectJson } from '../core/serialize';
import { newProject } from '../core/defaults';
import { FILE_EXT } from './autosave';
import {
  downloadJson,
  hasFSA,
  pickOpenFile,
  pickSaveTarget,
  pickUploadFile,
  readFile,
  writeFile,
} from './autosave';

/** Cached file handle for Ctrl+S without re-picking (per session). */
let currentHandle: FileSystemFileHandle | null = null;

export function currentFileName(): string | null {
  const st = useEditor.getState();
  if (currentHandle) return currentHandle.name;
  return st.fileName;
}

export function isDirty(): boolean {
  const st = useEditor.getState();
  return st.savedJson !== saveProjectJson(st.doc);
}

function confirmDiscard(): boolean {
  return window.confirm('当前工程有未保存的修改，确定放弃吗？');
}

export async function newProjectOp(): Promise<void> {
  if (isDirty() && !confirmDiscard()) return;
  currentHandle = null;
  useEditor.getState().loadDoc(newProject(), null);
}

export async function openOp(): Promise<void> {
  if (isDirty() && !confirmDiscard()) return;
  if (hasFSA()) {
    const handle = await pickOpenFile();
    if (!handle) return;
    const text = await readFile(handle);
    useEditor.getState().loadDoc(loadProjectJson(text), handle.name);
    currentHandle = handle;
    return;
  }
  const picked = await pickUploadFile();
  if (!picked) return;
  useEditor.getState().loadDoc(loadProjectJson(picked.text), picked.name);
  currentHandle = null;
}

export async function saveOp(): Promise<boolean> {
  const st = useEditor.getState();
  const json = saveProjectJson(st.doc);
  if (hasFSA()) {
    if (!currentHandle) return saveAsOp();
    try {
      await writeFile(currentHandle, json);
      st.markSaved();
      return true;
    } catch (err) {
      // handle may be stale (file moved/deleted) — fall back to Save As
      console.warn('save failed, falling back to Save As', err);
      return saveAsOp();
    }
  }
  const name = (st.fileName ?? defaultFileName()) + (st.fileName?.includes('.') ? '' : FILE_EXT);
  downloadJson(name, json);
  st.markSaved();
  useEditor.setState({ fileName: name });
  return true;
}

export async function saveAsOp(): Promise<boolean> {
  const st = useEditor.getState();
  const json = saveProjectJson(st.doc);
  if (hasFSA()) {
    const handle = await pickSaveTarget(defaultFileName() + FILE_EXT);
    if (!handle) return false;
    await writeFile(handle, json);
    currentHandle = handle;
    st.markSaved();
    useEditor.setState({ fileName: handle.name });
    return true;
  }
  const name = defaultFileName() + FILE_EXT;
  downloadJson(name, json);
  st.markSaved();
  useEditor.setState({ fileName: name });
  return true;
}

export function defaultFileName(): string {
  return useEditor.getState().doc.name || '未命名工程';
}
