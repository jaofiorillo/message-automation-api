import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { FlowStatus } from '../api/types';

type Variant = 'primary' | 'default' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover disabled:bg-primary/40 border border-transparent',
  default: 'bg-white text-ink border border-line hover:bg-black/[0.03]',
  danger: 'bg-white text-danger border border-line hover:bg-danger/5',
  ghost: 'text-ink hover:bg-black/5 border border-transparent',
};

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    />
  );
}

export function StatusBadge({ status }: { status: FlowStatus }) {
  return status === 'live' ? (
    <span className="rounded bg-live px-1.5 py-0.5 text-xs font-semibold text-white">
      LIVE
    </span>
  ) : (
    <span className="rounded border border-line px-1.5 py-0.5 text-xs font-semibold tracking-wide text-muted">
      DRAFT
    </span>
  );
}

export function InstagramIcon({
  className = 'size-5',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.35" stopColor="#fa7e1e" />
          <stop offset="0.6" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#ig-gradient)" />
      <rect
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        rx="4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3.1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
  aside,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  aside?: ReactNode;
}) {
  const titleId = useId();
  useEscape(onClose);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90vh] w-full ${width} flex-col rounded-xl bg-white shadow-2xl`}
      >
        <div className="flex items-center gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="flex-1 text-xl font-bold">
            {title}
          </h2>
          {aside}
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-black/5"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function useEscape(onEscape: () => void) {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

// A dropdown menu opened by a trigger button (ManyChat's "Mais ações").
export function Menu({
  label,
  trigger,
  items,
  align = 'right',
}: {
  label: string;
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    icon?: ReactNode;
  }[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="grid size-9 place-items-center rounded-md border border-line bg-white text-primary hover:bg-black/[0.03]"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-11 z-40 min-w-52 rounded-lg border border-line bg-white py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-black/5 ${item.danger ? 'text-danger' : 'text-ink'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Keyword chips: Enter or comma adds, Backspace on an empty field removes the
// last one (ManyChat's keyword field).
export function ChipsInput({
  value,
  onChange,
  placeholder,
  maxLength,
  maxItems,
  label,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  maxLength: number;
  maxItems: number;
  label: string;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const parts = text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
    if (parts.length === 0) return;
    const lower = new Set(value.map((item) => item.toLowerCase()));
    const next = [...value];
    for (const part of parts) {
      if (!lower.has(part.toLowerCase()) && next.length < maxItems) {
        next.push(part.slice(0, maxLength));
        lower.add(part.toLowerCase());
      }
    }
    onChange(next);
    setText('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-2 focus-within:border-primary">
      {value.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] py-1 pr-1.5 pl-3 text-sm"
        >
          {item}
          <button
            type="button"
            aria-label={`Remover ${item}`}
            onClick={() => onChange(value.filter((other) => other !== item))}
            className="rounded-full p-0.5 text-muted hover:bg-black/10"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={text}
        maxLength={maxLength * 4}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add();
          } else if (
            event.key === 'Backspace' &&
            text === '' &&
            value.length > 0
          ) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        disabled={value.length >= maxItems}
        className="min-w-24 flex-1 bg-transparent py-1 text-sm outline-none"
      />
    </div>
  );
}

export function Counter({ used, max }: { used: number; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${used > max ? 'font-semibold text-danger' : 'text-muted'}`}
    >
      {max - used}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-black/20'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}
