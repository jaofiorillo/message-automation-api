import { ReactFlowProvider } from '@xyflow/react';
import {
  Check,
  ChevronRight,
  CircleAlert,
  EllipsisVertical,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useFlow } from '../api/flows';
import type { Flow } from '../api/types';
import { Button, Menu, Modal, StatusBadge } from '../components/ui';
import { FlowCanvas, type Selection } from '../editor/FlowCanvas';
import { describePublishError } from '../editor/model';
import { CommentTriggerPanel } from '../editor/panels/CommentTriggerPanel';
import { ContentPanel } from '../editor/panels/ContentPanel';
import { KeywordTriggerPanel } from '../editor/panels/KeywordTriggerPanel';
import { TriggerPicker } from '../editor/panels/TriggerPicker';
import { useFlowEditor, type SaveStatus } from '../editor/useFlowEditor';
import { RemoveDialog, RenameDialog } from './AutomationsPage';

export function FlowEditorPage() {
  const { ns = '' } = useParams();
  const flow = useFlow(ns);

  if (flow.isPending) {
    return (
      <p className="grid h-full place-items-center text-muted">
        Carregando automação…
      </p>
    );
  }
  if (flow.isError) {
    const missing = flow.error instanceof ApiError && flow.error.status === 404;
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">
            {missing
              ? 'Automação não encontrada'
              : 'Não foi possível abrir a automação'}
          </p>
          {!missing && (
            <p className="mt-1 text-sm text-muted">{flow.error.message}</p>
          )}
          <Link
            to="/automations"
            className="mt-4 inline-block text-primary hover:underline"
          >
            Voltar para as automações
          </Link>
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider key={ns}>
      <Editor flow={flow.data} />
    </ReactFlowProvider>
  );
}

function Editor({ flow }: { flow: Flow }) {
  const editor = useFlowEditor(flow);
  const navigate = useNavigate();
  const [selection, setSelection] = useState<Selection>(null);
  const [picking, setPicking] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'remove' | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const readOnly = editor.mode === 'view';

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y), except inside text fields,
  // which keep their own undo.
  const { undo, redo } = editor;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable=true]'))
        return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const publish = async () => {
    setPublishing(true);
    try {
      await editor.publish();
      setNotice('Automação publicada');
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setPublishErrors(
          error.errors.map((item) => describePublishError(editor.draft, item)),
        );
      } else if (error instanceof ApiError && error.status === 409) {
        setNotice('Não há alterações para publicar');
      } else {
        setPublishErrors([
          error instanceof Error ? error.message : 'Erro ao publicar',
        ]);
      }
    } finally {
      setPublishing(false);
    }
  };

  const nothingToPublish =
    flow.status === 'live' &&
    !flow.hasUnpublishedChanges &&
    editor.status === 'saved';

  const closePanel = () => setSelection(null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-15 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4 sm:px-6">
        <nav
          aria-label="Navegação"
          className="flex min-w-0 items-center gap-2 text-[15px]"
        >
          <Link
            to="/automations"
            className="shrink-0 text-ink/70 hover:text-ink max-sm:hidden"
          >
            Automações
          </Link>
          <ChevronRight className="size-4 shrink-0 text-primary max-sm:hidden" />
          <span className="truncate">{flow.name}</span>
          <button
            type="button"
            aria-label="Renomear automação"
            onClick={() => setDialog('rename')}
            className="shrink-0 rounded p-1 text-muted hover:bg-black/5"
          >
            <Pencil className="size-4" />
          </button>
          <StatusBadge status={flow.status} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!readOnly && (
            <>
              <SaveIndicator
                status={editor.status}
                onRetry={() => void editor.save().catch(() => undefined)}
              />
              <div className="flex items-center border-x border-line px-1 max-sm:hidden">
                <IconButton
                  label="Desfazer"
                  onClick={editor.undo}
                  disabled={!editor.canUndo}
                >
                  <Undo2 className="size-4.5" />
                </IconButton>
                <IconButton
                  label="Refazer"
                  onClick={editor.redo}
                  disabled={!editor.canRedo}
                >
                  <Redo2 className="size-4.5" />
                </IconButton>
              </div>
            </>
          )}
          {readOnly ? (
            <Button onClick={editor.startEditing}>
              <Pencil className="size-4" /> Editar Automação
            </Button>
          ) : (
            <Button
              variant="primary"
              className="min-w-28"
              onClick={() => void publish()}
              disabled={publishing || nothingToPublish}
            >
              {publishing ? 'Publicando…' : 'Publicar'}
            </Button>
          )}
          <Menu
            label="Mais ações"
            trigger={<EllipsisVertical className="size-4" />}
            items={[
              {
                label: 'Renomear',
                onSelect: () => setDialog('rename'),
                icon: <Pencil className="size-4" />,
              },
              {
                label: 'Apagar',
                onSelect: () => setDialog('remove'),
                danger: true,
                icon: <Trash2 className="size-4" />,
              },
            ]}
          />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {selection?.kind === 'content' && (
          <ContentPanel
            key={selection.oid}
            editor={editor}
            oid={selection.oid}
            onClose={closePanel}
            onSelect={(oid) => setSelection({ kind: 'content', oid })}
          />
        )}
        {selection?.kind === 'keyword' && (
          <KeywordTriggerPanel
            key={selection.rule?.ruleId ?? 'new'}
            ns={flow.ns}
            rule={selection.rule}
            readOnly={readOnly}
            onClose={closePanel}
            onSaved={(rule) => {
              setSelection({ kind: 'keyword', rule });
              setNotice('Gatilho salvo');
            }}
          />
        )}
        {selection?.kind === 'comment' && (
          <CommentTriggerPanel
            key={selection.trigger?.triggerId ?? 'new'}
            ns={flow.ns}
            trigger={selection.trigger}
            readOnly={readOnly}
            onClose={closePanel}
            onSaved={(trigger) => {
              setSelection({ kind: 'comment', trigger });
              setNotice('Gatilho salvo');
            }}
          />
        )}

        <div className="relative min-w-0 flex-1">
          {readOnly ? (
            <div className="absolute top-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-b-md border border-t-0 border-[#f5d9b0] bg-warn-soft px-4 py-2 text-sm text-muted">
              Você está visualizando uma versão publicada
              <button
                type="button"
                onClick={editor.startEditing}
                className="text-primary underline"
              >
                Editar
              </button>
            </div>
          ) : (
            !selection && (
              <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-b-md border border-t-0 border-line bg-white/80 px-4 py-1.5 text-sm text-muted">
                👇 Toque no passo para editar
              </div>
            )
          )}
          <FlowCanvas
            editor={editor}
            keywords={flow.triggers.keywords}
            comments={flow.triggers.comments}
            selection={selection}
            onSelect={setSelection}
            onAddTrigger={() => setPicking(true)}
          />
          {notice && (
            <div
              role="status"
              className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg"
            >
              <Check className="size-4" /> {notice}
            </div>
          )}
        </div>
      </div>

      {picking && (
        <TriggerPicker
          onClose={() => setPicking(false)}
          onPick={(kind) => {
            setPicking(false);
            setSelection(
              kind === 'keyword' ? { kind: 'keyword' } : { kind: 'comment' },
            );
          }}
        />
      )}
      {publishErrors && (
        <Modal
          title="Não foi possível publicar"
          onClose={() => setPublishErrors(null)}
          footer={
            <Button variant="primary" onClick={() => setPublishErrors(null)}>
              Entendi
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted">
            Corrija estes pontos e publique de novo:
          </p>
          <ul className="grid gap-2">
            {publishErrors.map((error) => (
              <li key={error} className="flex gap-2 text-sm">
                <CircleAlert className="size-4 shrink-0 text-danger" /> {error}
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {dialog === 'rename' && (
        <RenameDialog flow={flow} onClose={() => setDialog(null)} />
      )}
      {dialog === 'remove' && (
        <RemoveDialog
          flow={flow}
          onClose={() => setDialog(null)}
          onRemoved={() => navigate('/automations')}
        />
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-sm text-danger hover:underline"
      >
        <CircleAlert className="size-4" /> Erro ao salvar · tentar de novo
      </button>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-sm text-muted max-sm:hidden"
      aria-live="polite"
    >
      {status === 'saved' ? (
        <>
          <Check className="size-4" /> Salvo
        </>
      ) : (
        'Salvando…'
      )}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-2 text-ink hover:bg-black/5 disabled:text-ink/25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
