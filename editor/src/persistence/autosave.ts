/**
 * Project file persistence: File System Access API with download/upload
 * fallback, plus localStorage autosave.
 */

const AUTOSAVE_KEY = 'wc3ui-editor-autosave';

export const FILE_EXT = '.wc3ui.json';

export function hasFSA(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

// ---- File System Access API (Chromium) ----

interface FSW extends Window {
  showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
}

const filePickerTypes = [
  {
    description: 'WC3 UI Project',
    accept: { 'application/json': ['.wc3ui.json'] },
  },
];

export async function pickSaveTarget(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  const w = window as FSW;
  if (!w.showSaveFilePicker) return null;
  try {
    return await w.showSaveFilePicker({
      suggestedName,
      types: filePickerTypes,
    });
  } catch {
    return null; // user cancelled
  }
}

export async function pickOpenFile(): Promise<FileSystemFileHandle | null> {
  const w = window as FSW;
  if (!w.showOpenFilePicker) return null;
  try {
    const [handle] = await w.showOpenFilePicker({ types: filePickerTypes });
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function writeFile(handle: FileSystemFileHandle, json: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
}

export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

// ---- fallback (download / file input) ----

export function downloadJson(fileName: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pick a project file via a transient file input (fallback for non-Chromium). */
export function pickUploadFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file.text().then((text) => resolve({ name: file.name, text }));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ---- autosave ----

export function saveAuto(json: string): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ json, time: Date.now() }));
  } catch {
    // quota — ignore
  }
}

export function loadAuto(): { json: string; time: number } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { json?: string; time?: number };
    if (typeof parsed.json !== 'string') return null;
    return { json: parsed.json, time: typeof parsed.time === 'number' ? parsed.time : 0 };
  } catch {
    return null;
  }
}

export function clearAuto(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}
