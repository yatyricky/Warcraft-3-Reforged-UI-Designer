import { useEffect, useState } from 'react';
import { resolveAssetUrl } from '../persistence/assetDir';

/**
 * Resolve a stored asset reference (`asset:<name>`) to a displayable URL.
 * Non-asset values pass through; missing files resolve to null so callers
 * can show a placeholder. Resolved blob URLs are cached inside assetDir.
 */
export function useAssetUrl(stored: string | undefined, projName: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!stored) {
        setUrl(null);
        return;
      }
      if (!stored.startsWith('asset:')) {
        setUrl(stored);
        return;
      }
      const resolved = await resolveAssetUrl(stored, projName);
      if (alive) setUrl(resolved);
    })();
    return () => {
      alive = false;
    };
  }, [stored, projName]);

  return url;
}
