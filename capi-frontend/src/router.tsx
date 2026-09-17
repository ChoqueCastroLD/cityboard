import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Toaster } from './components/ui/Toaster';
import { useCleanTheme } from './hooks/useCleanTheme';
import { HomeScreen } from './screens/HomeScreen';

const RoomScreen = lazy(() => import('./screens/RoomScreen').then((m) => ({ default: m.RoomScreen })));

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

function RoomLoading() {
  useCleanTheme();
  return (
    <div className="grid h-full place-items-center bg-surface text-ink" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full bg-fill px-5 py-3 text-sm text-muted">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        Preparando la mesa…
      </div>
    </div>
  );
}

function RoomRoute() {
  return (
    <Suspense fallback={<RoomLoading />}>
      <RoomScreen />
    </Suspense>
  );
}

function RootError({ error }: { error: unknown }) {
  useCleanTheme();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="grid h-full place-items-center bg-surface px-4 text-ink">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-fill p-6">
        <h2 className="text-lg font-semibold">Algo salió mal</h2>
        <p className="text-sm text-muted">Ocurrió un error inesperado en esta pantalla. Puedes volver al inicio; tu partida sigue guardada en el servidor.</p>
        <p className="text-xs break-all text-muted">{message}</p>
        <a className="btn btn-primary h-11" href="/">
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout, errorComponent: RootError });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen });
const roomRoute = createRoute({ getParentRoute: () => rootRoute, path: '/room/$code', component: RoomRoute });
const fallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, roomRoute, fallbackRoute]),
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
