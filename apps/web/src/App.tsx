import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { AutomationsPage } from './pages/AutomationsPage';

// The flow builder pulls in React Flow; load it only when an automation opens.
const FlowEditorPage = lazy(() =>
  import('./pages/FlowEditorPage').then((module) => ({
    default: module.FlowEditorPage,
  })),
);

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/automations" replace />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route
          path="automations/:ns"
          element={
            <Suspense
              fallback={
                <p className="grid h-full place-items-center text-muted">
                  Carregando editor…
                </p>
              }
            >
              <FlowEditorPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/automations" replace />} />
      </Route>
    </Routes>
  );
}
