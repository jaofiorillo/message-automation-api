import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Plus, Zap } from 'lucide-react';
import type { CommentTrigger, KeywordRule } from '../../api/types';
import { InstagramIcon } from '../../components/ui';
import {
  describeCommentTrigger,
  describeKeywordRule,
  triggerKinds,
} from '../../lib/triggers';
import { handleIds } from '../model';

export type TriggerNodeData = {
  keywords: KeywordRule[];
  comments: CommentTrigger[];
  readOnly: boolean;
  onAdd: () => void;
  onOpenKeyword: (rule: KeywordRule) => void;
  onOpenComment: (trigger: CommentTrigger) => void;
};

export type TriggerFlowNode = Node<TriggerNodeData, 'trigger'>;

// ManyChat's "Quando..." start node: the automation's triggers, and "Então"
// pointing at the first step.
export function TriggerNode({ data, selected }: NodeProps<TriggerFlowNode>) {
  const empty = data.keywords.length + data.comments.length === 0;
  return (
    <div
      className={`w-75 rounded-2xl border-2 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${selected ? 'border-selected' : 'border-transparent'}`}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 text-[15px]">
        <Zap className="size-4.5" strokeWidth={1.8} />
        Quando...
      </div>
      <div className="grid gap-2 px-3.5">
        {empty && (
          <p className="px-0.5 text-xs leading-relaxed text-muted">
            O gatilho é responsável por acionar a automação. Clique para
            adicionar um gatilho.
          </p>
        )}
        {data.keywords.map((rule) => (
          <TriggerItem
            key={`k${rule.ruleId}`}
            title={triggerKinds.keyword.description}
            detail={describeKeywordRule(rule)}
            onClick={() => data.onOpenKeyword(rule)}
          />
        ))}
        {data.comments.map((trigger) => (
          <TriggerItem
            key={`c${trigger.triggerId}`}
            title="O usuário comenta na sua publicação"
            detail={describeCommentTrigger(trigger)}
            onClick={() => data.onOpenComment(trigger)}
          />
        ))}
        {!data.readOnly && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data.onAdd();
            }}
            className="nodrag flex h-9 items-center justify-center gap-1 rounded-lg border border-dashed border-primary text-xs font-medium text-primary hover:bg-primary-soft"
          >
            <Plus className="size-3.5" /> Novo Gatilho
          </button>
        )}
      </div>
      <div className="relative mt-2 px-4 pb-3 text-right text-xs text-muted">
        Então
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

function TriggerItem({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="nodrag flex items-start gap-2 rounded-lg border border-trigger-line bg-trigger px-2.5 py-2 text-left hover:brightness-[0.98]"
    >
      <InstagramIcon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-[13px] leading-snug">{title}</span>
        <span className="block truncate text-[11px] text-muted">{detail}</span>
      </span>
    </button>
  );
}
