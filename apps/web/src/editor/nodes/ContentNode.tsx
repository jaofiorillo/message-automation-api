import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Link2 } from 'lucide-react';
import type { DraftContent } from '../../api/types';
import { InstagramIcon } from '../../components/ui';
import { defaultCaption, handleIds } from '../model';

export type ContentNodeData = { content: DraftContent; isRoot: boolean };

export type ContentFlowNode = Node<ContentNodeData, 'content'>;

// ManyChat's "Instagram · Enviar Mensagem" step: text bubbles, their buttons
// (a content button has its own outgoing link) and "Próximo Passo".
export function ContentNode({ data, selected }: NodeProps<ContentFlowNode>) {
  const { content } = data;
  return (
    <div
      className={`w-70 rounded-2xl border-2 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${selected ? 'border-selected' : 'border-transparent'}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="-left-1! top-7!"
      />
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <InstagramIcon className="size-6 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="block text-[10px] text-muted">Instagram</span>
          <span className="block truncate text-[14px] font-medium">
            {content.caption || defaultCaption}
          </span>
        </span>
      </div>
      <div className="grid gap-2 px-3.5">
        {content.messages.length === 0 && (
          <div className="grid h-10 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">
            Adicionar texto
          </div>
        )}
        {content.messages.map((message) => (
          <div
            key={message.oid}
            className="overflow-hidden rounded-lg bg-bubble"
          >
            <p
              className={`line-clamp-4 px-3 py-2 text-[13px] break-words whitespace-pre-wrap ${message.text ? '' : 'text-muted italic'}`}
            >
              {message.text || 'Mensagem sem texto'}
            </p>
            {message.buttons.map((button) => (
              <div
                key={button.oid}
                className="relative border-t border-white bg-white/70 px-6 py-1.5 text-center text-[12px] font-medium"
              >
                <span className="block truncate">
                  {button.caption || 'Botão'}
                </span>
                {button.action === 'url' ? (
                  <Link2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
                ) : (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleIds.button(message.oid, button.oid)}
                    className="right-2!"
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="relative mt-2 px-4 pb-3 text-right text-xs text-muted">
        Próximo Passo
        <Handle
          type="source"
          position={Position.Right}
          id={handleIds.next}
          className="-right-1!"
        />
      </div>
    </div>
  );
}
