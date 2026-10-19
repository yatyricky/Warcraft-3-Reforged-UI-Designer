import { useEffect, useState } from 'react';
import type { Vec2 } from '../core/types';

/**
 * Commit-on-blur/Enter inputs. Local state while focused, so typing partial
 * values doesn't fight the store; every commit is one undo step.
 */

export function TextField(props: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  mono?: boolean;
  disabled?: boolean;
}) {
  const { value, onCommit, placeholder, error, mono, disabled } = props;
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(value);
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    if (local !== value) onCommit(local);
  };

  return (
    <input
      className={`ed-input w-full ${mono ? 'font-mono' : ''}`}
      value={local}
      placeholder={placeholder}
      disabled={disabled}
      title={error ?? undefined}
      style={error && !focused ? { borderColor: '#c25b5b' } : undefined}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setLocal(value);
          setFocused(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function NumberField(props: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const { value, onCommit, step = 0.01, disabled, min, max } = props;
  const [local, setLocal] = useState(String(round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(String(round(value)));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const n = Number(local);
    if (Number.isFinite(n) && n !== value) {
      const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
      onCommit(clamped);
    }
  };

  return (
    <input
      type="number"
      className="ed-input w-full"
      value={local}
      step={step}
      disabled={disabled}
      min={min}
      max={max}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setLocal(String(round(value)));
          setFocused(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function Vec2Field(props: {
  value: Vec2;
  onCommit: (v: Vec2) => void;
  step?: number;
  labels?: [string, string];
  disabled?: boolean;
}) {
  const { value, onCommit, step, labels = ['X', 'Y'], disabled } = props;
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 shrink-0 text-[10px] text-[var(--ed-text-dim)]">{labels[0]}</span>
      <NumberField
        value={value.x}
        step={step}
        disabled={disabled}
        onCommit={(x) => onCommit({ ...value, x })}
      />
      <span className="w-3 shrink-0 text-[10px] text-[var(--ed-text-dim)]">{labels[1]}</span>
      <NumberField
        value={value.y}
        step={step}
        disabled={disabled}
        onCommit={(y) => onCommit({ ...value, y })}
      />
    </div>
  );
}

export function CheckField(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={props.hint}>
      <input
        type="checkbox"
        className="ed-check"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}

export function Row(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5" title={props.hint}>
      <span className="w-24 shrink-0 text-[11px] text-[var(--ed-text-dim)]">{props.label}</span>
      <div className="flex min-w-0 flex-1 items-center">{props.children}</div>
    </div>
  );
}

function round(v: number): number {
  return Number(v.toFixed(4));
}
