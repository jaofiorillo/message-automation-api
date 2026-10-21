import {
  ArrowDownUp,
  EllipsisVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  useCreateFlow,
  useFlows,
  useRemoveFlow,
  useRenameFlow,
} from '../api/flows';
import type { FlowStatus, FlowSummary } from '../api/types';
import {
  Button,
  InstagramIcon,
  Menu,
  Modal,
  StatusBadge,
} from '../components/ui';
import { timeAgo } from '../lib/format';
import {
  describeCommentTrigger,
  describeKeywordRule,
  matchesTriggerFilter,
  triggerKinds,
  type TriggerFilter,
} from '../lib/triggers';

type SortField = 'name' | 'modified';

// ManyChat's "Minhas automações" (cms?path=/): search, trigger and state
// filters, sort by name or modified date, one card per automation with its
// triggers.
export function AutomationsPage() {
  const flows = useFlows();
  const createFlow = useCreateFlow();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [trigger, setTrigger] = useState<TriggerFilter>('any');
  const [status, setStatus] = useState<FlowStatus | 'any'>('any');
  const [sort, setSort] = useState<{ field: SortField; desc: boolean }>({
    field: 'modified',
    desc: true,
  });
  const [renaming, setRenaming] = useState<FlowSummary | null>(null);
  const [removing, setRemoving] = useState<FlowSummary | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (flows.data ?? []).filter(
      (flow) =>
        (term === '' || flow.name.toLowerCase().includes(term)) &&
        (status === 'any' || flow.status === status) &&
        matchesTriggerFilter(flow.triggers, trigger),
    );
    const direction = sort.desc ? -1 : 1;
    return rows.sort((a, b) =>
      sort.field === 'name'
        ? direction * a.name.localeCompare(b.name, 'pt-BR')
        : direction * a.updatedAt.localeCompare(b.updatedAt),
    );
  }, [flows.data, search, status, trigger, sort]);

  const startFromScratch = () => {
    createFlow.mutate('Sem Título', {
      onSuccess: (flow) => navigate(`/automations/${flow.ns}`),
    });
  };

  const toggleSort = (field: SortField) =>
    setSort((current) =>
      current.field === field
        ? { field, desc: !current.desc }
        : { field, desc: field === 'modified' },
    );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-15 shrink-0 items-center border-b border-line px-8">
        <h1 className="text-2xl font-bold">Automação</h1>
      </header>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <aside className="w-56 shrink-0 p-4 max-lg:hidden">
          <span className="flex h-9 items-center gap-2 rounded-md bg-black/10 px-3 text-[15px]">
            <Workflow className="size-4" strokeWidth={1.6} />
            Minhas automações
          </span>
        </aside>
        <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
          <h2 className="text-2xl font-bold">Minhas automações</h2>
          <Button
            variant="primary"
            className="mt-5"
            onClick={startFromScratch}
            disabled={createFlow.isPending}
          >
            <Plus className="size-4" />
            Nova Automação
          </Button>
          {createFlow.isError && (
            <p className="mt-2 text-sm text-danger">
              Não foi possível criar a automação: {createFlow.error.message}
            </p>
          )}

          <div className="mt-6 grid gap-3">
            <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:border-primary">
              <Search className="size-4 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar todas as automações"
                className="flex-1 bg-transparent outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label="Filtrar por gatilho"
                value={trigger}
                onChange={(event) =>
                  setTrigger(event.target.value as TriggerFilter)
                }
                className="h-10 rounded-md border border-line bg-white px-3"
              >
                <option value="any">Qualquer gatilho</option>
                <option value="keyword">{triggerKinds.keyword.title}</option>
                <option value="comment">{triggerKinds.comment.title}</option>
                <option value="none">Sem gatilho</option>
              </select>
              <select
                aria-label="Filtrar por estado"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FlowStatus | 'any')
                }
                className="h-10 rounded-md border border-line bg-white px-3"
              >
                <option value="any">Todos os estados</option>
                <option value="live">Live</option>
                <option value="draft">Rascunho</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between px-5 text-sm text-muted">
            <button
              type="button"
              onClick={() => toggleSort('name')}
              className="flex items-center gap-1 hover:text-ink"
            >
              Nome <ArrowDownUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('modified')}
              className="flex items-center gap-1 hover:text-ink"
            >
              Modificado <ArrowDownUp className="size-3.5" />
            </button>
          </div>

          {flows.isPending && (
            <p className="mt-6 text-center text-muted">Carregando…</p>
          )}
          {flows.isError && (
            <p className="mt-6 rounded-lg bg-warn-soft p-4 text-sm">
              Não foi possível carregar as automações ({flows.error.message}). A
              API está rodando? (<code>pnpm dev:api</code>)
            </p>
          )}
          {flows.data && visible.length === 0 && (
            <p className="mt-6 rounded-xl bg-white p-8 text-center text-muted shadow-sm">
              {flows.data.length === 0
                ? 'Você ainda não tem automações. Crie a primeira em “Nova Automação”.'
                : 'Nenhuma automação encontrada com esses filtros.'}
            </p>
          )}

          <ul className="mt-3 grid gap-4">
            {visible.map((flow) => (
              <FlowCard
                key={flow.ns}
                flow={flow}
                onOpen={() => navigate(`/automations/${flow.ns}`)}
                onRename={() => setRenaming(flow)}
                onRemove={() => setRemoving(flow)}
              />
            ))}
          </ul>
        </section>
      </div>
      {renaming && (
        <RenameDialog flow={renaming} onClose={() => setRenaming(null)} />
      )}
      {removing && (
        <RemoveDialog flow={removing} onClose={() => setRemoving(null)} />
      )}
    </div>
  );
}

function FlowCard({
  flow,
  onOpen,
  onRename,
  onRemove,
}: {
  flow: FlowSummary;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const triggers = [
    ...flow.triggers.keywords.map((rule) => ({
      id: `k${rule.ruleId}`,
      text: describeKeywordRule(rule),
    })),
    ...flow.triggers.comments.map((comment) => ({
      id: `c${comment.triggerId}`,
      text: `Comentário: ${describeCommentTrigger(comment)}`,
    })),
  ];
  return (
    <li className="rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 p-5">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-3">
            <StatusBadge status={flow.status} />
            <span className="truncate text-lg font-semibold">{flow.name}</span>
          </span>
          {flow.hasUnpublishedChanges && flow.status === 'live' && (
            <span className="mt-1 block text-xs text-muted">
              Alterações não publicadas
            </span>
          )}
          <span className="mt-4 grid gap-2">
            {triggers.length === 0 ? (
              <span className="text-sm text-muted">Sem gatilho</span>
            ) : (
              triggers.map((item) => (
                <span key={item.id} className="flex items-center gap-2 text-sm">
                  <InstagramIcon className="size-4 shrink-0" />
                  <span className="truncate">{item.text}</span>
                </span>
              ))
            )}
          </span>
        </button>
        <span
          className="shrink-0 pt-1 text-sm text-muted"
          title={new Date(flow.updatedAt).toLocaleString('pt-BR')}
        >
          {timeAgo(flow.updatedAt)}
        </span>
        <Menu
          label={`Ações de ${flow.name}`}
          trigger={<EllipsisVertical className="size-4" />}
          items={[
            {
              label: 'Renomear',
              onSelect: onRename,
              icon: <Pencil className="size-4" />,
            },
            {
              label: 'Apagar',
              onSelect: onRemove,
              danger: true,
              icon: <Trash2 className="size-4" />,
            },
          ]}
        />
      </div>
    </li>
  );
}

export function RenameDialog({
  flow,
  onClose,
}: {
  flow: { ns: string; name: string };
  onClose: () => void;
}) {
  const rename = useRenameFlow();
  const [name, setName] = useState(flow.name);
  const submit = () => {
    if (name.trim() === '') return;
    rename.mutate({ ns: flow.ns, name: name.trim() }, { onSuccess: onClose });
  };
  return (
    <Modal
      title="Renomear automação"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={name.trim() === '' || rename.isPending}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          aria-label="Nome da automação"
          autoFocus
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          className="h-10 w-full rounded-md border border-line px-3 outline-none focus:border-primary"
        />
        {rename.isError && (
          <p className="mt-2 text-sm text-danger">{rename.error.message}</p>
        )}
      </form>
    </Modal>
  );
}

export function RemoveDialog({
  flow,
  onClose,
  onRemoved,
}: {
  flow: { ns: string; name: string };
  onClose: () => void;
  onRemoved?: () => void;
}) {
  const remove = useRemoveFlow();
  return (
    <Modal
      title="Apagar automação?"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(flow.ns, {
                onSuccess: () => {
                  onClose();
                  onRemoved?.();
                },
              })
            }
          >
            <Trash2 className="size-4" />
            Apagar
          </Button>
        </>
      }
    >
      <p>
        “{flow.name}” e seus gatilhos serão apagados. Esta ação não pode ser
        desfeita.
      </p>
      {remove.isError && (
        <p className="mt-2 text-sm text-danger">{remove.error.message}</p>
      )}
    </Modal>
  );
}
