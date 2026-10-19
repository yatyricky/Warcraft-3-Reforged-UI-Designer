/**
 * Project asset directory: ~/.tmp/W3RUID/<proj_name>/
 *
 * Browsers cannot write arbitrary paths, so the W3RUID root is picked once
 * via showDirectoryPicker and the directory handle is persisted in IndexedDB.
 * Assets are stored as `asset:<fileName>` references inside the project file
 * and resolved to blob URLs on demand.
 */

const DB_NAME = 'wc3ui-editor';const STORE = 'handles';
const ROOT_KEY = 'assetRoot';
export const ASSET_PREFIX = 'asset:';

interface FSW extends Window {
  showDirectoryPicker?: (opts?: unknown) => Promise<FileSystemDirectoryHandle>;
}

// ---- IndexedDB (tiny promise wrapper, handles only) ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, val: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // persistence of the handle is best-effort
  }
}

// ---- directory handle management ----

let cachedRoot: FileSystemDirectoryHandle | null = null;

/** Chrome-only permission members not yet in the default DOM lib. */
interface PermissibleHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

function asPermissible(h: FileSystemDirectoryHandle): PermissibleHandle {
  return h as unknown as PermissibleHandle;
}

/** True when this browser supports picking + writing a real directory. */
export function hasAssetDirSupport(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Return the W3RUID root directory handle, picking/persisting it if needed.
 * Must be called from a user gesture the first time (or when permission
 * needs re-granting). Returns null when cancelled or unsupported.
 */
export async function ensureAssetRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedRoot) return cachedRoot;
  const w = window as FSW;
  if (!w.showDirectoryPicker) return null;

  const saved = await idbGet<FileSystemDirectoryHandle>(ROOT_KEY);
  if (saved) {
    try {
      const p = asPermissible(saved);
      const q = await p.queryPermission({ mode: 'readwrite' });
      if (q === 'granted') {
        cachedRoot = saved;
        return cachedRoot;
      }
      const r = await p.requestPermission({ mode: 'readwrite' });
      if (r === 'granted') {
        cachedRoot = saved;
        return cachedRoot;
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const handle = await w.showDirectoryPicker({ mode: 'readwrite', id: 'w3ruid-assets' });
    await idbSet(ROOT_KEY, handle);
    cachedRoot = handle;
    return handle;
  } catch {
    return null; // user cancelled
  }
}

/** Windows-unsafe characters out of the project directory name. */
export function sanitizeDirName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : '未命名工程';
}

/** Generate a deduplicated asset file name: kind.ext, kind-2.ext, ... */
export function assetFileName(kind: string, ext: string, existing: ReadonlySet<string>): string {
  const safeExt = ext.replace(/[^A-Za-z0-9]/g, '') || 'png';
  if (!existing.has(`${kind}.${safeExt}`)) return `${kind}.${safeExt}`;
  for (let i = 2; ; i += 1) {
    const candidate = `${kind}-${i}.${safeExt}`;
    if (!existing.has(candidate)) return candidate;
  }
}

/** Extract the plain file name from a stored asset reference, or null. */
export function assetRefToName(stored: string | undefined): string | null {
  if (stored && stored.startsWith(ASSET_PREFIX)) {
    const name = stored.slice(ASSET_PREFIX.length);
    return name.length > 0 ? name : null;
  }
  return null;
}

async function getProjectDir(projName: string): Promise<FileSystemDirectoryHandle | null> {
  const root = await ensureAssetRoot();
  if (!root) return null;
  try {
    return await root.getDirectoryHandle(sanitizeDirName(projName), { create: true });
  } catch {
    return null;
  }
}

/** List file names already in the project asset dir (empty when unavailable). */
async function listAssets(dir: FileSystemDirectoryHandle): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
      out.add(name);
    }
  } catch {
    // ignore
  }
  return out;
}

/**
 * Copy a picked File into <proj>/ and return an `asset:<name>` reference.
 * Falls back to null when the asset dir is unavailable — callers then use a
 * session-only object URL.
 */
export async function importAssetToProject(
  file: File,
  projName: string,
  kind: string,
): Promise<string | null> {
  const dir = await getProjectDir(projName);
  if (!dir) return null;
  const ext = file.name.includes('.') ? file.name.split('.').pop()! : 'png';
  const existing = await listAssets(dir);
  const name = assetFileName(kind, ext, existing);
  try {
    const fh = await dir.getFileHandle(name, { create: true });
    const writable = await fh.createWritable();
    await writable.write(file);
    await writable.close();
    urlCache.set(cacheKey(projName, name), URL.createObjectURL(await fh.getFile()));
    return `${ASSET_PREFIX}${name}`;
  } catch {
    return null;
  }
}

// ---- resolution ----

const urlCache = new Map<string, string>();

function cacheKey(projName: string, name: string): string {
  return `${sanitizeDirName(projName)}/${name}`;
}

/**
 * Resolve an `asset:<name>` reference to a blob URL via the persisted handle.
 * Non-asset values (blob:/http:/data: URLs from older sessions) pass through.
 * Returns null when the file cannot be found.
 */
export async function resolveAssetUrl(
  stored: string,
  projName: string,
): Promise<string | null> {
  const name = assetRefToName(stored);
  if (!name) return stored || null;
  const key = cacheKey(projName, name);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const root = cachedRoot ?? (await idbGet<FileSystemDirectoryHandle>(ROOT_KEY));
  if (!root) return null;
  try {
    const dir = await root.getDirectoryHandle(sanitizeDirName(projName));
    const fh = await dir.getFileHandle(name);
    const url = URL.createObjectURL(await fh.getFile());
    urlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/** Pick a single image file from disk via a transient file input. */
export function pickImageFile(accept = 'image/png,image/jpeg,image/webp'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Full flow behind "选择图片…" buttons: the FILE picker always comes first
 * (that is the user's intent). Copying into <proj>/ happens right after;
 * only on the very first use does the one-time directory authorization
 * appear, and it does so after the image is chosen. Falls back to a session
 * object URL when the asset dir is unavailable or authorization is declined.
 */
export async function pickAndStoreImage(
  projName: string,
  kind: string,
): Promise<string | null> {
  const file = await pickImageFile();
  if (!file) return null;
  if (hasAssetDirSupport()) {
    const stored = await importAssetToProject(file, projName, kind);
    if (stored) return stored;
  }
  return URL.createObjectURL(file);
}
