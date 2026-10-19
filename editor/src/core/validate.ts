import type { ProjectDoc } from './types';

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Native frame names double as export variable names, so restrict to
 * identifier-safe characters. war3 itself is laxer; this is a deliberate v1
 * constraint to keep v2 codegen trivially correct.
 */
export function validateName(name: string): string | null {
  if (!name) return '名称不能为空';
  if (!IDENT_RE.test(name)) return '仅允许字母、数字、下划线，且以字母或下划线开头';
  return null;
}

/** Uniqueness across the project, case-insensitive (war3 frame names are case-insensitive). */
export function isNameTaken(doc: ProjectDoc, id: string, name: string): boolean {
  const lower = name.toLowerCase();
  for (const node of Object.values(doc.frames)) {
    if (node.id !== id && node.name.toLowerCase() === lower) return true;
  }
  return false;
}

export function nameError(doc: ProjectDoc, id: string, name: string): string | null {
  const base = validateName(name);
  if (base) return base;
  if (isNameTaken(doc, id, name)) return '名称已存在';
  return null;
}
