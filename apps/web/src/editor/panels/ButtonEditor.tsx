import { Link2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Draft, FlowButton } from '../../api/types';
import { Button, Counter, InstagramIcon, Modal } from '../../components/ui';
import { isHttpUrl, limits } from '../limits';
import { newStepValue, StepOptions } from './StepOptions';

// ManyChat's "Editar Botão": a title (20 characters) and what tapping it does,
// either the next Instagram step or opening a site. Changes are kept here
// until "Concluído", so an unfinished URL never reaches the draft (the API
// rejects it).
export function ButtonEditor({
  draft,
  contentOid,
  button,
  onClose,
  onSave,
  onRemove,
}: {
  draft: Draft;
  contentOid: string;
  button: FlowButton;
  onClose: () => void;
  onSave: (button: FlowButton, createStep: boolean) => void;
  onRemove: () => void;
}) {
  const [caption, setCaption] = useState(button.caption);
  const [action, setAction] = useState(button.action);
  const [target, setTarget] = useState(
    button.action === 'content'
      ? (button.targetOid ?? newStepValue)
      : newStepValue,
  );
  const [url, setUrl] = useState(
    button.action === 'url' ? button.url : 'https://',
  );
  const urlValid = isHttpUrl(url);

  const save = () => {
    if (action === 'url') {
      if (!urlValid) return;
      onSave({ oid: button.oid, caption, action: 'url', url }, false);
    } else {
      const createStep = target === newStepValue;
      onSave(
        createStep
          ? { oid: button.oid, caption, action: 'content' }
          : { oid: button.oid, caption, action: 'content', targetOid: target },
        createStep,
      );
    }
  };

  return (
    <Modal
      title="Editar Botão"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="danger" onClick={onRemove} className="mr-auto">
            <Trash2 className="size-4" /> Excluir Botão
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={action === 'url' && !urlValid}
          >
            Concluído
          </Button>
        </>
      }
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Título do botão</span>
        <span className="flex items-center gap-2 rounded-md border border-line px-3 focus-within:border-primary">
          <input
            autoFocus
            value={caption}
            maxLength={limits.buttonCaption}
            onChange={(event) => setCaption(event.target.value)}
            className="h-10 flex-1 outline-none"
          />
          <Counter used={caption.length} max={limits.buttonCaption} />
        </span>
      </label>

      <p className="mt-5 mb-2 text-sm font-medium">
        Quando este botão é pressionado
      </p>
      <div className="grid gap-2">
        <ActionOption
          selected={action === 'content'}
          onClick={() => setAction('content')}
        >
          <InstagramIcon className="size-7" />
          <span>
            <span className="block font-medium">Instagram</span>
            <span className="block text-xs text-muted">
              Enviar outra etapa da automação
            </span>
          </span>
        </ActionOption>
        {action === 'content' && (
          <select
            aria-label="Etapa enviada pelo botão"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="ml-11 h-10 rounded-md border border-line bg-white px-3"
          >
            <StepOptions draft={draft} exclude={contentOid} />
          </select>
        )}
        <ActionOption
          selected={action === 'url'}
          onClick={() => setAction('url')}
        >
          <Link2 className="size-7 text-primary" />
          <span>
            <span className="block font-medium">Abrir Site</span>
            <span className="block text-xs text-muted">
              Abre um link (http ou https)
            </span>
          </span>
        </ActionOption>
        {action === 'url' && (
          <div className="ml-11">
            <input
              aria-label="Endereço do site"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={`h-10 w-full rounded-md border px-3 outline-none ${urlValid ? 'border-line focus:border-primary' : 'border-danger'}`}
            />
            {!urlValid && (
              <p className="mt-1 text-xs text-danger">
                Informe um endereço começando com http:// ou https://
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ActionOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-left ${selected ? 'border-primary bg-primary-soft' : 'border-dashed border-line hover:border-primary'}`}
    >
      {children}
    </button>
  );
}
