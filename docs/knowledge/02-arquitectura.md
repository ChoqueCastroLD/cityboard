# Arquitectura

Monorepo con workspaces de Bun (Bun 1.4, TypeScript estricto).

```
capi-core/      motor puro y determinista, sin I/O; lo usan servidor y cliente
capi-api/       Bun + Elysia + Prisma (SQLite vía libsql); REST + WebSocket
capi-frontend/  React 18 + Vite 6 + TanStack Router/Query + Tailwind 4 + Motion
deploy/         nginx, backup, watchdog
docs/           esta documentación
```

## Flujo de una jugada

1. El cliente envía `{ type: 'command', command }` por WebSocket (o REST si no hay socket).
2. `GameService.execute` encola el comando por partida (una cola por `gameId`, nunca dos a la vez).
3. El motor aplica `apply(board, state, command) → { state, events }`.
4. Se persiste el estado completo como JSON en `Game.state` y los últimos 150 eventos en `Game.history`.
5. Se difunde `{ type: 'state', game, events }` a todos los sockets de la sala.
6. Cada cliente aplica el estado y anima los eventos (dados, movimiento, cartas).

## Por qué así

- El motor es compartido: el cliente calcula acciones disponibles (`getAvailableActions`) con el mismo código que valida el servidor.
- El estado se guarda como blob JSON: no hay consultas relacionales sobre él, así que SQLite basta. Ver [04-servidor](04-servidor.md).
- El servidor es un solo proceso con estado en memoria (salas WS, presencia, relojes). No se puede escalar horizontalmente sin reescribir eso, con independencia de la base.

## Arranque local

```bash
bun install
cd capi-api && cp .env.example .env && bun run db:setup && bun run dev   # :3000
bun run --cwd capi-frontend dev                                          # :5173
```

Sin `DATABASE_URL` la API usa memoria. En desarrollo Vite sirve bajo `/monopoly/` también (ver [05-frontend](05-frontend.md)).
