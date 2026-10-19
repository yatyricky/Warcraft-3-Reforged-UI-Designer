import { describe, expect, it } from 'vitest';
import {
  ASSET_PREFIX,
  assetFileName,
  assetRefToName,
  sanitizeDirName,
} from '../src/persistence/assetDir';

describe('sanitizeDirName', () => {
  it('replaces Windows-unsafe characters', () => {
    expect(sanitizeDirName('myProj')).toBe('myProj');
    // < > : / \ | ? * → each becomes one underscore
    expect(sanitizeDirName('a<b>:c/d\\e|f?g*h')).toBe('a_b__c_d_e_f_g_h');
    expect(sanitizeDirName('  未命名工程  ')).toBe('未命名工程');
  });
  it('falls back to a default only when nothing remains', () => {
    expect(sanitizeDirName('')).toBe('未命名工程');
    expect(sanitizeDirName('///')).toBe('___');
  });
});

describe('assetFileName', () => {
  it('uses kind.ext when free', () => {
    expect(assetFileName('background', 'png', new Set())).toBe('background.png');
  });
  it('dedupes with -2, -3 suffixes', () => {
    const existing = new Set(['background.png', 'background-2.png']);
    expect(assetFileName('background', 'png', existing)).toBe('background-3.png');
  });
  it('sanitizes the extension', () => {
    expect(assetFileName('texture', '.j p g', new Set())).toBe('texture.jpg');
    expect(assetFileName('texture', '', new Set())).toBe('texture.png');
  });
});

describe('assetRefToName', () => {
  it('extracts names from asset references', () => {
    expect(assetRefToName(`${ASSET_PREFIX}bg.png`)).toBe('bg.png');
    expect(assetRefToName(ASSET_PREFIX)).toBeNull();
    expect(assetRefToName('blob:http://x/y')).toBeNull();
    expect(assetRefToName('')).toBeNull();
    expect(assetRefToName(undefined)).toBeNull();
  });
});
