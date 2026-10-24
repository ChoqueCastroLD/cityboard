# Caída o errores

## 1. Dónde falla

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://capichan.com/monopoly/          # web
curl -s https://capichan.com/monopoly/api/health                                 # api por fuera
docker compose -f /root/cityboard/docker-compose.yml ps                          # estado y salud
docker exec capi-api bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
```

| Resultado | Probable causa |
| --- | --- |
| 503 "no available server" | `capi-web` reiniciándose o caído |
| 502 en `/monopoly/api/...` | `capi-api` caído o arrancando |
| 404 en todo `/monopoly` | se perdieron las labels de Traefik o la red `coolify` |
| 521/522 de Cloudflare | Traefik (`coolify-proxy`) caído o el VPS sin red |

## 2. Logs

```bash
docker logs --tail 100 capi-api
docker logs --tail 100 capi-web
docker logs --since 10m coolify-proxy 2>&1 | grep -i capichan
tail -20 /var/log/capichan-watchdog.log
```

## 3. Arreglos habituales

- Contenedor `unhealthy` o parado: `docker compose up -d` en `/root/cityboard`. El watchdog lo hace solo cada 5 min.
- `SQLITE_BUSY` en logs: confirmar WAL (`journal_mode` debe ser `wal`) y que no haya otro proceso abriendo `/data/capi.db`.
- Falla `prisma db push` al arrancar: ver el error en `docker logs capi-api`; suele ser un cambio de schema incompatible. Revertir: [rollback](rollback.md).
- Memoria del VPS llena: `free -m`; el VPS es compartido, revisar otros contenedores antes de tocar los del juego.

## 4. Errores en el navegador

"Algo salió mal" en pantalla es el error boundary: el mensaje de abajo es la excepción. Reproducir con [qa-visual](qa-visual.md) capturando `pageerror`.
