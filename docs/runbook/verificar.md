# Verificar

Tests, typecheck y smoke. No hay Bun en el host: se usa un contenedor.

## Tests y typecheck

```bash
cd /root/cityboard
docker run --rm -v /root/cityboard:/app -w /app oven/bun:1-debian sh -c '
  bun install --silent >/dev/null 2>&1
  bun run --cwd capi-core test
  cd capi-api && bun x prisma generate >/dev/null && NODE_ENV=test bun test && bun x tsc -p tsconfig.json --noEmit && echo API-TS-OK
  cd ../capi-frontend && bun x tsc -p tsconfig.json --noEmit && echo WEB-TS-OK'
```

Esperado: 29 tests de core, 8 de api, sin salida de `tsc` antes de los `OK`.

Sin `prisma generate`, el typecheck de la API da errores falsos en `prisma-game-repository.ts`.

## Smoke

Prueba REST y WebSocket de punta a punta (crear sala, unirse, auth inmediato, chat, empezar, tirar dados).

Contra el contenedor desplegado:

```bash
docker cp capi-api/scripts/smoke.ts capi-api:/app/capi-api/scripts/smoke.ts
docker exec capi-api sh -c 'cd /app/capi-api && SMOKE_URL=http://127.0.0.1:3000 bun run scripts/smoke.ts'
```

Contra la URL pública (pasa por Cloudflare y Traefik):

```bash
docker exec capi-api sh -c 'cd /app/capi-api && SMOKE_URL=https://capichan.com/monopoly bun run scripts/smoke.ts'
```

Esperado: todas las líneas `ok` y `smoke OK`. Sale con código 1 si algo falla.
