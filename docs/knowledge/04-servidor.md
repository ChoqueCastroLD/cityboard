# Servidor (capi-api)

## Rutas

Todas bajo `/api/*` (REST) y `/ws/games/:id` (WebSocket). En producción van detrás de `/monopoly`, que Traefik quita antes de llegar. Swagger en `/docs` solo fuera de producción.

## Protocolo WebSocket

1. El cliente abre `/ws/games/:id` **sin credenciales**: entra como espectador y recibe `state`, `chat-history` y `presence`.
2. Para jugar envía `{ type: 'auth', requestId?, secret }`. Respuesta `ack` o `error`.
3. Luego `command`, `chat`, `rtc`, `ping`.

Decisiones:

- El secreto **no** va en la URL (`?secret=` acababa en logs de Traefik y Cloudflare).
- La conexión se registra en la sala **antes** del primer `await` de `open`, para que un `auth` enviado justo en `onopen` no se pierda (bug real, ver [08-lecciones](08-lecciones.md)).
- Los handlers nunca hacen `return ws.send(...)`: Elysia envía el valor de retorno como frame y el cliente recibía números sueltos.

## Persistencia

- Prisma con adaptador libsql sobre SQLite (`queryCompiler` + `driverAdapters`, porque el motor nativo de Prisma falla en Bun/Windows).
- En producción `DATABASE_URL=file:/data/capi.db` en el volumen `capi-data`. `prisma db push` corre al arrancar el contenedor.
- Al conectar se aplican `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON` (`src/db.ts`). Sin WAL un escritor bloqueaba a los lectores.
- Tablas: `Game`, `PlayerSession`, `User`, `LoginCode`, `AuthSession`, `GameResult`.
- `Game.disconnects` guarda los plazos de desconexión (`playerId → timestamp`). Al arrancar, el gateway los restaura; si el plazo venció con la API caída se dan 60 s de gracia.

## Límites y seguridad

- Cuerpo HTTP máx. 64 KB, mensaje WS máx. 16 KB.
- Rate limit en memoria (10 min): código por correo 5/email y 10/IP, verificación 10/IP, crear sala 20/IP.
- La IP sale de `x-forwarded-for` (primer valor). Detrás de Cloudflare ese valor lo puede falsear el cliente; ver [09-pendientes](09-pendientes.md).
- Cuentas: código de 6 dígitos por correo (Resend). Token `X-Account: Bearer`. Invitados permitidos.

## Coste del tick

Cada segundo `tick()` carga y parsea **todas** las partidas `playing`. Con cientos de partidas simultáneas será el primer cuello de botella, antes que SQLite.

Tests: `cd capi-api && NODE_ENV=test bun test` (8). Smoke: `bun run smoke` (ver runbook).
