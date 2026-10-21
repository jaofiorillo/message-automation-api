import { Search } from 'lucide-react';
import { useState } from 'react';
import { InstagramIcon, Modal } from '../../components/ui';
import { triggerKinds, type TriggerKind } from '../../lib/triggers';

// ManyChat's "Iniciar automação quando...". The triggers this backend runs
// are selectable; the others are listed as coming soon.
const options: { kind?: TriggerKind; title: string; description: string }[] = [
  { kind: 'comment', ...triggerKinds.comment },
  {
    title: 'Resposta ao story',
    description: 'O usuário responde ao seu Story',
  },
  { kind: 'keyword', ...triggerKinds.keyword },
  {
    title: 'Compartilhar publicação ou reel',
    description: 'O usuário compartilha sua publicação ou reel em um Story',
  },
];

export function TriggerPicker({
  onPick,
  onClose,
}: {
  onPick: (kind: TriggerKind) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const visible = options.filter((option) =>
    `${option.title} ${option.description}`.toLowerCase().includes(term),
  );
  return (
    <Modal
      title="Iniciar automação quando..."
      onClose={onClose}
      width="max-w-3xl"
      aside={
        <label className="flex h-10 w-60 items-center gap-2 rounded-md border border-line px-3 focus-within:border-primary max-sm:hidden">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por Instagram"
            className="min-w-0 flex-1 outline-none"
          />
        </label>
      }
    >
      <div className="flex gap-6">
        <div className="w-44 shrink-0 max-sm:hidden">
          <span className="flex h-9 items-center gap-2 rounded-md bg-black/[0.05] px-3">
            <InstagramIcon className="size-4" /> Instagram
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">Gatilhos</h3>
          <p className="mb-3 text-xs text-muted">
            Evento específico do Instagram que inicia sua automação.
          </p>
          <div className="grid gap-3">
            {visible.map((option) => (
              <button
                key={option.title}
                type="button"
                disabled={!option.kind}
                onClick={() => option.kind && onPick(option.kind)}
                className="flex items-center gap-4 rounded-xl border border-line px-4 py-4 text-left enabled:hover:border-primary enabled:hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-55"
              >
                <InstagramIcon className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">
                    {option.title}
                  </span>
                  <span className="block text-[15px]">
                    {option.description}
                  </span>
                </span>
                {!option.kind && (
                  <span className="rounded bg-black/[0.06] px-2 py-0.5 text-xs text-muted">
                    Em breve
                  </span>
                )}
              </button>
            ))}
            {visible.length === 0 && (
              <p className="text-sm text-muted">Nenhum gatilho encontrado.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
