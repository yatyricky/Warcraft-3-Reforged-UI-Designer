import { describe, expect, it } from 'vitest';
import { makeFrame, newProject } from '../src/core/defaults';
import { loadProject, loadProjectJson, saveProjectJson } from '../src/core/serialize';
import { vec2 } from '../src/core/defaults';
import type { ProjectDoc } from '../src/core/types';

function buildSample(): ProjectDoc {
  const doc = newProject('示例');
  doc.libraryName = 'DEMOUI';
  const root = doc.frames[doc.rootId];
  const panel = makeFrame('FRAME', 'Panel', root);
  const text = makeFrame('TEXT', 'Title', panel);
  text.props.text = '你好';
  text.props.color = '#ffcc00';
  text.layout.anchorMin = vec2(0.5, 0.5);
  doc.frames[panel.id] = panel;
  doc.frames[text.id] = text;
  root.childIds.push(panel.id);
  panel.childIds.push(text.id);
  return doc;
}

describe('save/load roundtrip', () => {
  it('preserves the full tree', () => {
    const doc = buildSample();
    doc.settings.background = 'custom';
    doc.settings.backgroundImage = 'asset:bg.png';
    const json = saveProjectJson(doc);
    const loaded = loadProjectJson(json);
    expect(loaded.name).toBe('示例');
    expect(loaded.libraryName).toBe('DEMOUI');
    expect(loaded.settings.background).toBe('custom');
    expect(loaded.settings.backgroundImage).toBe('asset:bg.png');
    const root = loaded.frames[loaded.rootId];
    expect(root.childIds).toHaveLength(1);
    const panel = loaded.frames[root.childIds[0]];
    expect(panel.name).toBe('Panel');
    expect(panel.childIds).toHaveLength(1);
    const text = loaded.frames[panel.childIds[0]];
    expect(text.props.text).toBe('你好');
    expect(text.props.color).toBe('#ffcc00');
    expect(text.layout.anchorMin).toEqual(vec2(0.5, 0.5));
  });

  it('re-saving the loaded doc yields identical JSON', () => {
    const doc = buildSample();
    const json = saveProjectJson(doc);
    expect(saveProjectJson(loadProjectJson(json))).toBe(json);
  });
});

describe('defensive load', () => {
  it('returns a fresh project for garbage input', () => {
    expect(loadProjectJson('not json').frames).toHaveProperty('root');
    expect(loadProjectJson('[]').rootId).toBe('root');
    expect(loadProject(null).rootId).toBe('root');
  });

  it('falls back to defaults for bad fields', () => {
    const loaded = loadProject({
      name: 42,
      root: {
        children: [
          { type: 'WAT', layout: { sizeDelta: 'x' }, props: { textScale: 'big' }, children: 'nope' },
          { name: 'ok', type: 'IMAGE' },
        ],
      },
    });
    const root = loaded.frames[loaded.rootId];
    expect(root.childIds).toHaveLength(2);
    const bad = loaded.frames[root.childIds[0]];
    expect(bad.type).toBe('FRAME');
    expect(bad.name).toBeTruthy();
    expect(bad.layout.sizeDelta).toEqual({ x: 0.2, y: 0.2 });
    expect(bad.props.textScale).toBe(1);
    expect(bad.childIds).toEqual([]);
    expect(loaded.name).toBe('未命名工程');
  });

  it('de-duplicates names case-insensitively', () => {
    const loaded = loadProject({
      root: {
        children: [{ name: 'Panel' }, { name: 'PANEL' }, { name: 'panel' }],
      },
    });
    const names = loaded.frames[loaded.rootId].childIds.map(
      (id) => loaded.frames[id].name.toLowerCase(),
    );
    expect(new Set(names)).toHaveLength(3);
  });

  it('regenerates duplicate ids', () => {
    const loaded = loadProject({
      root: {
        children: [
          { id: 'same', name: 'A' },
          { id: 'same', name: 'B' },
        ],
      },
    });
    const root = loaded.frames[loaded.rootId];
    const [a, b] = root.childIds.map((id) => loaded.frames[id]);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBe('same');
  });
});
