import type { CSSProperties, PointerEvent } from 'react';
import type { FrameNode } from '../../core/types';
import { useAssetUrl } from '../../hooks/useAssetUrl';

/**
 * Per-type visual approximation on the canvas. FRAME and IMAGE mirror the
 * Zulaman-WE runtime closely; the other types are simplified previews.
 */
export function FrameView(props: {
  node: FrameNode;
  projectName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { node, projectName, x, y, w, h, onPointerEnter, onPointerLeave } = props;
  const ghost = !node.visible || !node.active;
  const p = node.props;
  const previewUrl = useAssetUrl(p.texturePreviewPath, projectName);

  const onPointerDown = (e: PointerEvent) => {
    // let the canvas container handle selection/drag; ghosts are not interactive
    if (ghost) {
      e.stopPropagation();
      return;
    }
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: Math.max(1, w),
    height: Math.max(1, h),
  };

  let inner: React.ReactNode = null;
  switch (node.type) {
    case 'FRAME':
      inner = null;
      break;
    case 'IMAGE':
      inner = <TextureBox texture={p.texture} previewUrl={previewUrl} w={w} h={h} />;
      break;
    case 'TEXT':
      inner = <TextBox node={node} boxed={false} />;
      break;
    case 'BUTTON':
      inner = (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[3px] border border-[#6b5a33] bg-[#2a2622]">
          {p.texture ? (
            <TextureBox texture={p.texture} previewUrl={previewUrl} w={w} h={h} absolute />
          ) : null}
          {p.text ? <TextBox node={node} boxed={false} overlay /> : null}
        </div>
      );
      break;
    case 'CHECKBOX':
      inner = (
        <div className="flex h-full w-full items-center gap-1">
          <div
            className="shrink-0 border border-[#8a8a8a] bg-[#1d1f22]"
            style={{ width: Math.min(h, w), height: Math.min(h, w) }}
          />
          {p.text ? <TextBox node={node} boxed={false} overlay /> : null}
        </div>
      );
      break;
    case 'STATUSBAR': {
      const fill = Math.max(0, Math.min(100, p.value));
      inner = (
        <div className="relative h-full w-full overflow-hidden border border-black bg-[#141414]">
          <div
            className="h-full"
            style={{ width: `${fill}%`, background: 'linear-gradient(#7db63f, #55912a)' }}
          />
          {p.text ? <TextBox node={node} boxed={false} overlay /> : null}
        </div>
      );
      break;
    }
    case 'SLIDER': {
      const t = p.max > p.min ? (p.value - p.min) / (p.max - p.min) : 0;
      const horizontal = w >= h;
      inner = (
        <div className="relative h-full w-full">
          <div
            className="absolute bg-[#3a3d42]"
            style={
              horizontal
                ? { left: '4%', right: '4%', top: '50%', height: 6, transform: 'translateY(-50%)' }
                : { top: '4%', bottom: '4%', left: '50%', width: 6, transform: 'translateX(-50%)' }
            }
          />
          <div
            className="absolute rounded-sm border border-[#777] bg-[#c9a44a]"
            style={
              horizontal
                ? {
                    left: `calc(${(t * 92 + 4).toFixed(2)}% - 7px)`,
                    top: '50%',
                    width: 14,
                    height: Math.max(14, h * 0.6),
                    transform: 'translateY(-50%)',
                  }
                : {
                    top: `calc(${((1 - t) * 92 + 4).toFixed(2)}% - 7px)`,
                    left: '50%',
                    width: Math.max(14, w * 0.6),
                    height: 14,
                    transform: 'translateX(-50%)',
                  }
            }
          />
        </div>
      );
      break;
    }
    case 'EDITBOX':
      inner = (
        <div className="h-full w-full border border-[#5a5a5a] bg-[#101214] px-1">
          <TextBox node={node} boxed={false} overlay align="left" />
        </div>
      );
      break;
    case 'TEXTAREA':
      inner = (
        <div className="h-full w-full border border-[#4a4a4a] bg-[#101214] p-1">
          <TextBox node={node} boxed={false} overlay multiline />
        </div>
      );
      break;
  }

  return (
    <div
      data-frame-id={node.id}
      style={style}
      className={ghost ? 'pointer-events-none opacity-30' : ''}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
    >
      {inner}
    </div>
  );
}

function TextureBox(props: {
  texture: string;
  previewUrl: string | null;
  w: number;
  h: number;
  absolute?: boolean;
}) {
  const { texture, previewUrl, absolute } = props;
  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt=""
        draggable={false}
        className={absolute ? 'absolute inset-0 h-full w-full object-cover' : 'h-full w-full object-cover'}
      />
    );
  }
  if (texture) {
    // war3 path with no local preview: striped placeholder
    return (
      <div
        title={texture}
        className={
          'flex items-center justify-center overflow-hidden ' +
          (absolute ? 'absolute inset-0' : 'h-full w-full')
        }
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #2e3340 0 6px, #262b36 6px 12px)',
        }}
      >
        <span className="max-w-full truncate px-1 text-[9px] text-[#8fa2c0] ed-frame-label">
          {texture.split('\\').pop()}
        </span>
      </div>
    );
  }
  return <div className="h-full w-full bg-[#23262b]" />;
}

function TextBox(props: {
  node: FrameNode;
  boxed: boolean;
  overlay?: boolean;
  multiline?: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  const { node, overlay, multiline, align } = props;
  const p = node.props;
  const hor = align ?? p.textHorAlign;
  const style: CSSProperties = {
    color: p.color,
    fontSize: Math.max(8, 14 * p.textScale),
    lineHeight: 1.2,
    textAlign: hor,
    justifyContent:
      p.textVerAlign === 'top' ? 'flex-start' : p.textVerAlign === 'bottom' ? 'flex-end' : 'center',
    whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
  };
  return (
    <div
      className={
        (overlay ? 'absolute inset-0 ' : 'flex h-full w-full ') +
        'flex flex-col overflow-hidden px-0.5'
      }
      style={style}
    >
      <span className={hor === 'left' ? 'self-start' : hor === 'right' ? 'self-end' : 'self-center'}>
        {p.text}
      </span>
    </div>
  );
}
