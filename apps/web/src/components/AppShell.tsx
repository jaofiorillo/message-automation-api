import { Bot, House, Inbox, Settings, UserRound, Workflow } from 'lucide-react';
import { NavLink, Outlet, useMatch } from 'react-router';

// ManyChat's left navigation. Only "Automação" exists in this app; the other
// entries are shown disabled so the layout matches.
const items = [
  { label: 'Inicial', icon: House },
  { label: 'Contatos', icon: UserRound },
  { label: 'Automação', icon: Workflow, to: '/automations' },
  { label: 'IA', icon: Bot },
  { label: 'Caixa de Entrada', icon: Inbox },
  { label: 'Configurações', icon: Settings },
];

export function AppShell() {
  // The flow builder collapses the navigation to icons, like ManyChat.
  const compact = useMatch('/automations/:ns') !== null;
  return (
    <div className="flex h-full">
      <nav
        aria-label="Menu principal"
        className={`flex shrink-0 flex-col border-r border-line bg-canvas ${compact ? 'w-16' : 'w-56 max-md:w-16'}`}
      >
        <div className="flex h-15 items-center gap-2 border-b border-line px-5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-white">
            M
          </span>
          {!compact && (
            <span className="text-lg font-bold tracking-tight max-md:hidden">
              Automações
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-1 p-2">
          {items.map(({ label, icon: Icon, to }) => (
            <li key={label}>
              {to ? (
                <NavLink
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    `flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] ${isActive ? 'bg-black/10 text-ink' : 'text-ink/80 hover:bg-black/5'}`
                  }
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.6} />
                  {!compact && <span className="max-md:hidden">{label}</span>}
                </NavLink>
              ) : (
                <span
                  title={`${label} (não disponível)`}
                  aria-disabled="true"
                  className="flex h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-[15px] text-ink/35"
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.6} />
                  {!compact && <span className="max-md:hidden">{label}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
