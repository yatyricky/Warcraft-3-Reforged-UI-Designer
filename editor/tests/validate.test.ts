import { describe, expect, it } from 'vitest';
import { isNameTaken, validateName } from '../src/core/validate';
import { newProject } from '../src/core/defaults';

describe('validateName', () => {
  it('accepts identifier-safe names', () => {
    expect(validateName('Frame1')).toBeNull();
    expect(validateName('_hidden')).toBeNull();
    expect(validateName('HUD_Panel_2')).toBeNull();
  });
  it('rejects bad names', () => {
    expect(validateName('')).not.toBeNull();
    expect(validateName('1abc')).not.toBeNull();
    expect(validateName('my frame')).not.toBeNull();
    expect(validateName('我的框架')).not.toBeNull();
    expect(validateName('a-b')).not.toBeNull();
  });
});

describe('isNameTaken', () => {
  it('is case-insensitive and ignores self', () => {
    const doc = newProject('t');
    const rootId = doc.rootId;
    const a = { ...doc.frames[rootId], id: 'a', name: 'Panel', parentId: rootId };
    doc.frames[a.id] = a;
    doc.frames[rootId].childIds.push('a');
    expect(isNameTaken(doc, 'a', 'PANEL')).toBe(false);
    expect(isNameTaken(doc, 'other', 'panel')).toBe(true);
    expect(isNameTaken(doc, 'other', 'Panel2')).toBe(false);
  });
});
