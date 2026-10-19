let counter = 0;

/** Collision-free-enough id for editor session and file persistence. */
export function newId(prefix = 'f'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Reset counter — test isolation only. */
export function _resetIdCounter(): void {
  counter = 0;
}
