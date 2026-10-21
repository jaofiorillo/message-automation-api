import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTriggerMutations } from '../../api/flows';
import { ApiError } from '../../api/client';
import type {
  KeywordCondition,
  KeywordConflict,
  KeywordGroup,
  KeywordRule,
} from '../../api/types';
import { Button, ChipsInput, InstagramIcon } from '../../components/ui';
import { conditionLabels, triggerKinds } from '../../lib/triggers';
import { limits } from '../limits';
import { SidePanel } from './SidePanel';

// "Mensagem no Instagram" (ManyChat's DM Keyword): the message is / contains /
// starts with one of the keywords. Saved on its own, like keywords/create.
export function KeywordTriggerPanel({
  ns,
  rule,
  readOnly,
  onClose,
  onSaved,
}: {
  ns: string;
  rule?: KeywordRule;
  readOnly: boolean;
  onClose: () => void;
  onSaved: (rule: KeywordRule) => void;
}) {
  const { saveKeyword, removeKeyword } = useTriggerMutations(ns);
  const [groups, setGroups] = useState<KeywordGroup[]>(
    rule?.keywordRules ?? [{ condition: 'contains', keywords: [] }],
  );
  const valid =
    groups.length > 0 && groups.every((group) => group.keywords.length > 0);
  const conflicts =
    saveKeyword.error instanceof ApiError && saveKeyword.error.status === 409
      ? (saveKeyword.error.list('conflicts') as KeywordConflict[])
      : [];

  const update = (index: number, group: KeywordGroup) =>
    setGroups((current) =>
      current.map((other, i) => (i === index ? group : other)),
    );

  return (
    <SidePanel
      tone="trigger"
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <InstagramIcon className="size-5" /> {triggerKinds.keyword.title}
        </span>
      }
      footer={
        readOnly ? undefined : (
          <>
            {rule && (
              <Button
                variant="danger"
                className="mr-auto"
                disabled={removeKeyword.isPending}
                onClick={() =>
                  removeKeyword.mutate(rule.ruleId, { onSuccess: onClose })
                }
              >
                <Trash2 className="size-4" /> Excluir
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!valid || saveKeyword.isPending}
              onClick={() =>
                saveKeyword.mutate(
                  {
                    ruleId: rule?.ruleId,
                    input: { channel: 'instagram', keywordRules: groups },
                  },
                  { onSuccess: onSaved },
                )
              }
            >
              {saveKeyword.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        )
      }
    >
      <h3 className="text-lg font-semibold">
        Quando o usuário envia uma mensagem
      </h3>
      <p className="mt-1 text-xs text-muted">
        As palavras-chave ignoram maiúsculas e minúsculas. Basta uma das
        condições ser verdadeira.
      </p>

      <div className="mt-5 grid gap-4">
        {groups.map((group, index) => (
          <div key={index} className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span>A mensagem</span>
              <select
                aria-label={`Condição ${index + 1}`}
                value={group.condition}
                disabled={readOnly}
                onChange={(event) =>
                  update(index, {
                    ...group,
                    condition: event.target.value as KeywordCondition,
                  })
                }
                className="h-8 rounded-md border border-line bg-white px-2 font-semibold"
              >
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {groups.length > 1 && !readOnly && (
                <button
                  type="button"
                  aria-label={`Remover condição ${index + 1}`}
                  onClick={() =>
                    setGroups((current) =>
                      current.filter((_g, i) => i !== index),
                    )
                  }
                  className="ml-auto rounded p-1 text-muted hover:bg-black/5 hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {readOnly ? (
              <p className="flex flex-wrap gap-2">
                {group.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-black/[0.06] px-3 py-1 text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </p>
            ) : (
              <ChipsInput
                label={`Palavras-chave da condição ${index + 1}`}
                value={group.keywords}
                onChange={(keywords) => update(index, { ...group, keywords })}
                placeholder="Digite e pressione Enter"
                maxLength={limits.keyword}
                maxItems={limits.keywordsPerGroup}
              />
            )}
          </div>
        ))}
      </div>

      {!readOnly && groups.length < limits.keywordGroups && (
        <button
          type="button"
          onClick={() =>
            setGroups((current) => [
              ...current,
              { condition: 'contains', keywords: [] },
            ])
          }
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="size-4" /> Adicionar condição
        </button>
      )}

      {conflicts.length > 0 && (
        <div className="mt-5 rounded-lg bg-warn-soft p-3 text-sm">
          Estas palavras-chave já são usadas por outra automação no Instagram:
          <ul className="mt-1 list-disc pl-5">
            {conflicts.map((conflict) => (
              <li
                key={`${conflict.ruleId}-${conflict.condition}-${conflict.keyword}`}
              >
                “{conflict.keyword}” ({conditionLabels[conflict.condition]})
              </li>
            ))}
          </ul>
        </div>
      )}
      {saveKeyword.isError && conflicts.length === 0 && (
        <p className="mt-4 text-sm text-danger">{saveKeyword.error.message}</p>
      )}
    </SidePanel>
  );
}
