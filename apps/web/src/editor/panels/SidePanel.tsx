import { X } from 'lucide-react';
import type { ReactNode } from 'react';

// The left sidebar of the flow builder; its header colour tells the step kind
// (pink for messages, green for triggers), as in ManyChat.
export function SidePanel({
  tone,
  title,
  onClose,
  children,
  footer,
}: {
  tone: 'message' | 'trigger';
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-r border-line bg-white max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full">
      <div
        className={`flex h-15 shrink-0 items-center gap-2 px-4 ${tone === 'message' ? 'bg-message-head' : 'bg-trigger-head'}`}
      >
        <div className="min-w-0 flex-1 truncate text-base font-bold">
          {title}
        </div>
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={onClose}
          className="rounded p-1 hover:bg-black/5"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-3">
          {footer}
        </div>
      )}
    </aside>
  );
}
