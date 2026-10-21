import { Check, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTriggerMutations } from '../../api/flows';
import type { CommentTrigger, CommentTriggerInput } from '../../api/types';
import {
  Button,
  ChipsInput,
  Counter,
  InstagramIcon,
  Toggle,
} from '../../components/ui';
import { triggerKinds } from '../../lib/triggers';
import { limits } from '../limits';
import { SidePanel } from './SidePanel';

// ManyChat pre-fills three replies and picks one at random per comment.
const defaultReplies = [
  'Obrigado! Te mandei uma mensagem no direct 😉',
  'Enviei no seu direct, confere lá ✨',
  'Acabei de te mandar uma DM!',
];

const mediaIdPattern = /^\d{1,32}$/;

type Form = CommentTriggerInput & {
  posts: 'all' | 'specific';
  words: 'any' | 'specific';
  replyPublicly: boolean;
};

function toForm(trigger?: CommentTrigger): Form {
  return {
    posts: trigger && trigger.mediaIds.length > 0 ? 'specific' : 'all',
    words: trigger && trigger.includeKeywords.length > 0 ? 'specific' : 'any',
    replyPublicly: (trigger?.publicReplies.length ?? 0) > 0,
    mediaIds: trigger?.mediaIds ?? [],
    includeKeywords: trigger?.includeKeywords ?? [],
    excludeKeywords: trigger?.excludeKeywords ?? [],
    rootCommentsOnly: trigger?.rootCommentsOnly ?? false,
    publicReplies: trigger?.publicReplies.length
      ? trigger.publicReplies
      : defaultReplies,
  };
}

function toInput(form: Form): CommentTriggerInput {
  return {
    mediaIds: form.posts === 'specific' ? form.mediaIds : [],
    includeKeywords: form.words === 'specific' ? form.includeKeywords : [],
    excludeKeywords: form.excludeKeywords,
    rootCommentsOnly: form.rootCommentsOnly,
    publicReplies: form.replyPublicly
      ? form.publicReplies
          .map((reply) => reply.trim())
          .filter((reply) => reply !== '')
      : [],
  };
}

const stepValid = [
  (form: Form) => form.posts === 'all' || form.mediaIds.length > 0,
  (form: Form) => form.words === 'any' || form.includeKeywords.length > 0,
  (form: Form) =>
    !form.replyPublicly ||
    (form.publicReplies.some((reply) => reply.trim() !== '') &&
      form.publicReplies.every((reply) => reply.length <= limits.publicReply)),
];

// "Comentários na publicação ou Reel" (ManyChat's feed_comment_trigger
// widget): which posts, which comments, and an optional public reply. A new
// trigger is set up in three steps; an existing one opens as a summary.
export function CommentTriggerPanel({
  ns,
  trigger,
  readOnly,
  onClose,
  onSaved,
}: {
  ns: string;
  trigger?: CommentTrigger;
  readOnly: boolean;
  onClose: () => void;
  onSaved: (trigger: CommentTrigger) => void;
}) {
  const { saveComment, removeComment } = useTriggerMutations(ns);
  const [form, setForm] = useState(() => toForm(trigger));
  const [step, setStep] = useState<number | null>(trigger ? null : 0);
  const set = (patch: Partial<Form>) =>
    setForm((current) => ({ ...current, ...patch }));

  const save = () =>
    saveComment.mutate(
      { triggerId: trigger?.triggerId, input: toInput(form) },
      {
        onSuccess: (saved) => {
          setStep(null);
          onSaved(saved);
        },
      },
    );

  const title = (
    <span className="flex items-center gap-2">
      <InstagramIcon className="size-5" /> {triggerKinds.comment.title}
    </span>
  );

  if (step === null) {
    return (
      <SidePanel
        tone="trigger"
        title={title}
        onClose={onClose}
        footer={
          readOnly ? undefined : (
            <>
              {trigger && (
                <Button
                  variant="danger"
                  className="mr-auto"
                  disabled={removeComment.isPending}
                  onClick={() =>
                    removeComment.mutate(trigger.triggerId, {
                      onSuccess: onClose,
                    })
                  }
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              )}
              <Button variant="primary" onClick={() => setStep(0)}>
                Editar
              </Button>
            </>
          )
        }
      >
        <Summary number={1} title="Quando alguém faz um comentário">
          {form.posts === 'all'
            ? 'Todas as publicações ou Reels'
            : `Publicações específicas: ${form.mediaIds.join(', ')}`}
        </Summary>
        <Summary number={2} title="E seu comentário">
          {form.words === 'any' ? (
            'Qualquer comentário'
          ) : (
            <>
              Contém: <Chips items={form.includeKeywords} />
            </>
          )}
          {form.excludeKeywords.length > 0 && (
            <span className="mt-2 block">
              Não contém: <Chips items={form.excludeKeywords} />
            </span>
          )}
          {form.rootCommentsOnly && (
            <span className="mt-2 block text-muted">
              Apenas comentários principais
            </span>
          )}
        </Summary>
        <Summary number={3} title="Responder também ao comentário">
          {form.replyPublicly ? (
            <ul className="grid gap-1">
              {toInput(form).publicReplies.map((reply) => (
                <li key={reply} className="rounded-lg bg-bubble px-3 py-2">
                  {reply}
                </li>
              ))}
            </ul>
          ) : (
            'Não responder publicamente'
          )}
        </Summary>
      </SidePanel>
    );
  }

  const last = step === 2;
  return (
    <SidePanel
      tone="trigger"
      title={title}
      onClose={onClose}
      footer={
        <>
          {step > 0 && (
            <Button className="mr-auto" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {trigger && step === 0 && (
            <Button
              className="mr-auto"
              onClick={() => {
                setForm(toForm(trigger));
                setStep(null);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!stepValid[step](form) || saveComment.isPending}
            onClick={() => (last ? save() : setStep(step + 1))}
          >
            {last
              ? saveComment.isPending
                ? 'Salvando…'
                : 'Salvar'
              : 'Continuar'}
          </Button>
        </>
      }
    >
      <p className="text-sm">Etapa {step + 1} de 3</p>
      <div className="mt-2 mb-5 h-1 rounded bg-black/10">
        <div
          className="h-1 rounded bg-selected transition-all"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      {step === 0 && (
        <>
          <h3 className="mb-4 text-xl font-bold">
            Qual publicação ou Reel você deseja utilizar na automação?
          </h3>
          <div className="grid gap-3">
            <Choice
              selected={form.posts === 'specific'}
              onClick={() => set({ posts: 'specific' })}
              title="Publicação ou Reels específico"
            >
              {form.posts === 'specific' && (
                <div
                  className="mt-3 grid gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ChipsInput
                    label="IDs das publicações"
                    value={form.mediaIds}
                    onChange={(mediaIds) =>
                      set({
                        mediaIds: mediaIds.filter((id) =>
                          mediaIdPattern.test(id),
                        ),
                      })
                    }
                    placeholder="ID da mídia, ex.: 17895695668004550"
                    maxLength={32}
                    maxItems={limits.mediaIds}
                  />
                  <span className="text-xs text-muted">
                    Informe o ID numérico da mídia no Instagram (Graph API). A
                    escolha pela grade de publicações ainda não está disponível.
                  </span>
                </div>
              )}
            </Choice>
            <Choice
              selected={form.posts === 'all'}
              onClick={() => set({ posts: 'all' })}
              title="Todas as publicações ou Reels"
            />
            <Choice
              selected={false}
              disabled
              title="Próxima publicação ou Reel"
              detail="Em breve"
            />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h3 className="mb-4 text-xl font-bold">E esse comentário possui</h3>
          <div className="grid gap-3">
            <Choice
              selected={form.words === 'specific'}
              onClick={() => set({ words: 'specific' })}
              title="Uma palavra ou expressão específica"
            >
              {form.words === 'specific' && (
                <div
                  className="mt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="mb-2 text-sm">
                    O comentário <b>contém</b> estas palavras-chave:
                  </p>
                  <ChipsInput
                    label="Palavras incluídas"
                    value={form.includeKeywords}
                    onChange={(includeKeywords) => set({ includeKeywords })}
                    placeholder="Ex.: link, preço"
                    maxLength={limits.keyword}
                    maxItems={limits.keywordsPerGroup}
                  />
                </div>
              )}
            </Choice>
            <Choice
              selected={form.words === 'any'}
              onClick={() => set({ words: 'any' })}
              title="Qualquer palavra"
            />
          </div>
          <p className="mt-5 mb-2 text-sm">
            O comentário <b>não contém</b> estas palavras-chave:
          </p>
          <ChipsInput
            label="Palavras excluídas"
            value={form.excludeKeywords}
            onChange={(excludeKeywords) => set({ excludeKeywords })}
            placeholder="Opcional"
            maxLength={limits.keyword}
            maxItems={limits.keywordsPerGroup}
          />
          <p className="mt-2 text-xs text-muted">
            As palavras-chave ignoram maiúsculas e minúsculas.
          </p>
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.rootCommentsOnly}
              onChange={(event) =>
                set({ rootCommentsOnly: event.target.checked })
              }
              className="mt-0.5 size-4 accent-primary"
            />
            Apenas comentários principais (ignorar respostas a outros
            comentários)
          </label>
        </>
      )}

      {step === 2 && (
        <>
          <h3 className="mb-4 text-xl font-bold">
            Responder também ao comentário?
          </h3>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
            <span>
              <span className="block font-medium">Responder publicamente</span>
              <span className="block text-xs text-muted">
                Uma das respostas é escolhida aleatoriamente.
              </span>
            </span>
            <Toggle
              checked={form.replyPublicly}
              onChange={(replyPublicly) => set({ replyPublicly })}
              label="Responder publicamente"
            />
          </div>
          {form.replyPublicly && (
            <div className="mt-4 grid gap-3">
              {form.publicReplies.map((reply, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-line bg-bubble"
                >
                  <textarea
                    aria-label={`Resposta ${index + 1}`}
                    value={reply}
                    rows={2}
                    maxLength={limits.publicReply}
                    onChange={(event) =>
                      set({
                        publicReplies: form.publicReplies.map((other, i) =>
                          i === index ? event.target.value : other,
                        ),
                      })
                    }
                    className="block w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex items-center justify-between px-3 pb-1.5">
                    <button
                      type="button"
                      aria-label={`Remover resposta ${index + 1}`}
                      onClick={() =>
                        set({
                          publicReplies: form.publicReplies.filter(
                            (_r, i) => i !== index,
                          ),
                        })
                      }
                      className="rounded p-1 text-muted hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <Counter used={reply.length} max={limits.publicReply} />
                  </div>
                </div>
              ))}
              {form.publicReplies.length < limits.publicReplies && (
                <button
                  type="button"
                  onClick={() =>
                    set({ publicReplies: [...form.publicReplies, ''] })
                  }
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="size-4" /> Adicionar resposta
                </button>
              )}
            </div>
          )}
          {saveComment.isError && (
            <p className="mt-4 text-sm text-danger">
              {saveComment.error.message}
            </p>
          )}
        </>
      )}
    </SidePanel>
  );
}

function Choice({
  selected,
  onClick,
  title,
  detail,
  disabled = false,
  children,
}: {
  selected: boolean;
  onClick?: () => void;
  title: string;
  detail?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(event) => {
        if (
          !disabled &&
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`rounded-xl border-2 px-4 py-3.5 text-left ${disabled ? 'cursor-not-allowed border-transparent bg-black/[0.04] text-muted' : selected ? 'cursor-pointer border-selected' : 'cursor-pointer border-line hover:border-black/30'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{title}</span>
        {detail && <span className="text-xs">{detail}</span>}
        {selected && <Check className="size-4 text-selected" />}
      </span>
      {children}
    </div>
  );
}

function Summary({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-black/[0.06] text-xs">
          {number}
        </span>
        {title}
      </h3>
      <div className="rounded-xl border border-line p-4 text-sm">
        {children}
      </div>
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-black/[0.06] px-3 py-1">
          {item}
        </span>
      ))}
    </span>
  );
}
