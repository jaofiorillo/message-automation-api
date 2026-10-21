import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { FlowSummary } from '../api/types';
import { AutomationsPage } from './AutomationsPage';

const base: Omit<FlowSummary, 'ns' | 'name' | 'status' | 'updatedAt'> = {
  path: '/',
  hasUnpublishedChanges: false,
  publishedAt: null,
  createdAt: '2026-10-19T12:00:00.000Z',
  triggers: { keywords: [], comments: [] },
};

const flows: FlowSummary[] = [
  {
    ...base,
    ns: 'content20261020120000_000001',
    name: 'Link na bio',
    status: 'live',
    updatedAt: '2026-10-20T10:00:00.000Z',
    triggers: {
      keywords: [
        {
          ruleId: 1,
          ns: 'content20261020120000_000001',
          name: 'x',
          channel: 'instagram',
          sort: 0,
          keywordRules: [{ condition: 'contains', keywords: ['link'] }],
        },
      ],
      comments: [],
    },
  },
  {
    ...base,
    ns: 'content20261020120000_000002',
    name: 'Rascunho de teste',
    status: 'draft',
    updatedAt: '2026-10-20T11:00:00.000Z',
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/automations']}>
        <Routes>
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/automations/:ns" element={<p>editor aberto</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AutomationsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              ...flows[1],
              ns: 'content20261020120000_000003',
              name: 'Sem Título',
            }),
            { status: 201 },
          );
        }
        expect(url).toBe('/api/flows?path=/');
        return new Response(JSON.stringify(flows), { status: 200 });
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists automations newest first with their triggers', async () => {
    renderPage();
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Rascunho de teste')).toBeInTheDocument();
    expect(within(items[0]).getByText('DRAFT')).toBeInTheDocument();
    expect(within(items[1]).getByText('LIVE')).toBeInTheDocument();
    expect(
      within(items[1]).getByText('A mensagem contém link'),
    ).toBeInTheDocument();
  });

  it('filters by search, trigger and state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Link na bio');

    await user.type(
      screen.getByPlaceholderText('Pesquisar todas as automações'),
      'rascunho',
    );
    expect(screen.queryByText('Link na bio')).not.toBeInTheDocument();
    await user.clear(
      screen.getByPlaceholderText('Pesquisar todas as automações'),
    );

    await user.selectOptions(
      screen.getByLabelText('Filtrar por gatilho'),
      'keyword',
    );
    expect(screen.queryByText('Rascunho de teste')).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Filtrar por gatilho'),
      'any',
    );

    await user.selectOptions(
      screen.getByLabelText('Filtrar por estado'),
      'live',
    );
    expect(screen.getByText('Link na bio')).toBeInTheDocument();
    expect(screen.queryByText('Rascunho de teste')).not.toBeInTheDocument();
  });

  it('creates an untitled automation and opens the editor', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Link na bio');
    await user.click(screen.getByRole('button', { name: /Nova Automação/ }));
    expect(await screen.findByText('editor aberto')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/flows',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Sem Título' }),
      }),
    );
  });
});
