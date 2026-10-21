import {
  ChevronRight,
  Copy,
  Info,
  Link2,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import { useState } from 'react';
import type { FlowButton } from '../../api/types';
import { Button, Counter } from '../../components/ui';
import { limits, textUsage } from '../limits';
import {
  addContent,
  connect,
  defaultCaption,
  duplicateContent,
  findContent,
  newOid,
  positionNextTo,
  removeContent,
  textMessage,
  updateContent,
  updateMessage,
} from '../model';
import type { FlowEditor } from '../useFlowEditor';
import { ButtonEditor } from './ButtonEditor';
import { newStepValue, StepOptions } from './StepOptions';
import { SidePanel } from './SidePanel';

export function ContentPanel({
  editor,
  oid,
  onClose,
  onSelect,
}: {
  editor: FlowEditor;
  oid: string;
  onClose: () => void;
  onSelect: (oid: string) => void;
}) {
  const { draft, change } = editor;
  const readOnly = editor.mode === 'view';
  const content = findContent(draft, oid);
  const [editing, setEditing] = useState<{
    messageOid: string;
    buttonOid: string;
  } | null>(null);
  if (!content) return null;

  const isRoot = draft.rootContent === oid;
  const editingButton = editing
    ? content.messages
        .find((message) => message.oid === editing.messageOid)
        ?.buttons.find((button) => button.oid === editing.buttonOid)
    : undefined;

  const linkNext = (value: string) => {
    if (value === newStepValue) {
      let created = '';
      change((d) => {
        const added = addContent(d, positionNextTo(d, oid));
        created = added.oid;
        return connect(
          added.draft,
          { kind: 'next', contentOid: oid },
          added.oid,
        );
      });
      if (created) onSelect(created);
    } else {
      change((d) =>
        connect(d, { kind: 'next', contentOid: oid }, value || null),
      );
    }
  };

  const addButton = (messageOid: string, count: number) => {
    const button: FlowButton = {
      oid: newOid(),
      caption: `Botão #${count + 1}`,
      action: 'content',
    };
    change((d) =>
      updateMessage(d, oid, messageOid, (message) => ({
        ...message,
        buttons: [...message.buttons, button],
      })),
    );
    setEditing({ messageOid, buttonOid: button.oid });
  };

  return (
    <SidePanel
      tone="message"
      onClose={onClose}
      title={
        <input
          aria-label="Nome da etapa"
          value={content.caption}
          placeholder={defaultCaption}
          maxLength={limits.contentCaption}
          disabled={readOnly}
          onChange={(event) =>
            change(
              (d) =>
                updateContent(d, oid, (c) => ({
                  ...c,
                  caption: event.target.value,
                })),
              `caption:${oid}`,
            )
          }
          className="w-full truncate rounded bg-transparent px-1 text-center text-lg outline-none focus:bg-white/60"
        />
      }
      footer={
        readOnly ? undefined : (
          <>
            <Button
              onClick={() => {
                let copy = '';
                change((d) => {
                  const result = duplicateContent(d, oid);
                  if (!result) return d;
                  copy = result.oid;
                  return result.draft;
                });
                if (copy) onSelect(copy);
              }}
            >
              <Copy className="size-4" /> Duplicar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                change((d) => removeContent(d, oid));
                onClose();
              }}
            >
              <Trash2 className="size-4" /> Apagar etapa
            </Button>
          </>
        )
      }
    >
      {isRoot && (
        <p className="mb-4 flex gap-2 rounded-lg bg-primary-soft p-3 text-xs leading-relaxed">
          <Info className="size-4 shrink-0 text-primary" />
          Primeira etapa. Quando o gatilho é um comentário, a primeira mensagem
          vai como resposta privada ao comentário (o Instagram permite uma por
          comentário); o resto segue quando a pessoa toca em um botão.
        </p>
      )}

      <div className="grid gap-5">
        {content.messages.map((message, index) => {
          const usage = textUsage(message.text, message.buttons.length > 0);
          return (
            <div key={message.oid} className="group">
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>Texto {index + 1}</span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Apagar texto ${index + 1}`}
                    onClick={() =>
                      change((d) =>
                        updateContent(d, oid, (c) => ({
                          ...c,
                          messages: c.messages.filter(
                            (m) => m.oid !== message.oid,
                          ),
                        })),
                      )
                    }
                    className="rounded p-1 hover:bg-black/5 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-line bg-bubble">
                <textarea
                  aria-label={`Texto ${index + 1}`}
                  value={message.text}
                  disabled={readOnly}
                  maxLength={limits.textBytes}
                  rows={4}
                  placeholder="Digite sua mensagem…"
                  onChange={(event) =>
                    change(
                      (d) =>
                        updateMessage(d, oid, message.oid, (m) => ({
                          ...m,
                          text: event.target.value,
                        })),
                      `text:${message.oid}`,
                    )
                  }
                  className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none"
                />
                <div
                  className="flex justify-end px-3 pb-1.5"
                  title={`Máximo de ${usage.max} ${usage.unit}`}
                >
                  <Counter used={usage.used} max={usage.max} />
                </div>
                {message.buttons.map((button) => (
                  <button
                    key={button.oid}
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      setEditing({
                        messageOid: message.oid,
                        buttonOid: button.oid,
                      })
                    }
                    className="flex w-full items-center border-t border-line bg-white text-sm text-primary hover:bg-primary-soft disabled:cursor-default disabled:hover:bg-white"
                  >
                    <span className="flex-1 truncate px-3 py-2.5">
                      {button.caption || 'Botão'}
                    </span>
                    <span className="grid w-12 place-items-center self-stretch border-l border-line">
                      {button.action === 'url' ? (
                        <Link2 className="size-4" />
                      ) : (
                        <ChevronRight
                          className={`size-4 ${button.targetOid ? '' : 'text-danger'}`}
                        />
                      )}
                    </span>
                  </button>
                ))}
                {!readOnly &&
                  message.buttons.length < limits.buttonsPerMessage && (
                    <button
                      type="button"
                      onClick={() =>
                        addButton(message.oid, message.buttons.length)
                      }
                      className="w-full border-t border-dashed border-primary/60 bg-white py-2.5 text-sm text-primary hover:bg-primary-soft"
                    >
                      + Botão Adicionar
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && content.messages.length < limits.messagesPerContent && (
        <>
          <hr className="my-6 border-line" />
          <p className="mb-2 text-xs text-muted">
            Adicione um dos blocos de conteúdo:
          </p>
          <button
            type="button"
            onClick={() =>
              change((d) =>
                updateContent(d, oid, (c) => ({
                  ...c,
                  messages: [...c.messages, textMessage()],
                })),
              )
            }
            className="flex w-full items-center gap-4 rounded-xl border border-dashed border-line px-4 py-3 text-left hover:border-primary hover:bg-primary-soft"
          >
            <Type className="size-5 text-muted" />
            <span>
              <span className="block font-medium">Texto</span>
              <span className="block text-xs text-muted">
                Adicione texto simples e botões
              </span>
            </span>
            <Plus className="ml-auto size-4 text-muted" />
          </button>
        </>
      )}

      <hr className="my-6 border-line" />
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Próximo Passo</span>
        <span className="text-xs text-muted">
          Enviado logo depois das mensagens desta etapa, sem esperar um toque.
        </span>
        <select
          value={content.targetOid ?? ''}
          disabled={readOnly}
          onChange={(event) => linkNext(event.target.value)}
          className="h-10 rounded-md border border-line bg-white px-3"
        >
          <option value="">Nenhum</option>
          <StepOptions draft={draft} exclude={oid} />
        </select>
      </label>

      {editing && editingButton && (
        <ButtonEditor
          key={editingButton.oid}
          draft={draft}
          contentOid={oid}
          button={editingButton}
          onClose={() => setEditing(null)}
          onSave={(button, createStep) => {
            let created = '';
            change((d) => {
              let next = d;
              let saved = button;
              if (createStep && saved.action === 'content') {
                const added = addContent(next, positionNextTo(next, oid));
                created = added.oid;
                next = added.draft;
                saved = { ...saved, targetOid: added.oid };
              }
              return updateMessage(next, oid, editing.messageOid, (m) => ({
                ...m,
                buttons: m.buttons.map((b) =>
                  b.oid === saved.oid ? saved : b,
                ),
              }));
            });
            setEditing(null);
            if (created) onSelect(created);
          }}
          onRemove={() => {
            change((d) =>
              updateMessage(d, oid, editing.messageOid, (m) => ({
                ...m,
                buttons: m.buttons.filter((b) => b.oid !== editing.buttonOid),
              })),
            );
            setEditing(null);
          }}
        />
      )}
    </SidePanel>
  );
}
