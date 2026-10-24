# Desplegar

Subir cambios del repo a https://capichan.com/monopoly.

## Pasos

1. Verificar antes: [verificar](verificar.md) (tests + typecheck).
2. Actualizar el checkout:
   ```bash
   cd /root/cityboard && git pull
   ```
3. Construir y levantar. Solo lo que cambió:
   ```bash
   docker compose build capi-web && docker compose up -d capi-web   # cambios de frontend
   docker compose build capi-api && docker compose up -d capi-api   # cambios de API o schema
   docker compose up -d --build                                     # ambos, o cambios en compose/.env
   ```
4. Esperar a que estén sanos:
   ```bash
   until [ "$(docker inspect -f '{{.State.Health.Status}}' capi-web)" = healthy ] && \
         [ "$(docker inspect -f '{{.State.Health.Status}}' capi-api)" = healthy ]; do sleep 3; done
   ```
5. Comprobar en vivo:
   ```bash
   curl -s https://capichan.com/monopoly/api/health
   curl -s -o /dev/null -w '%{http_code}\n' https://capichan.com/monopoly/
   ```
6. Correr el smoke contra producción: [verificar](verificar.md#smoke).

## Notas

- Reiniciar `capi-api` corta los WebSocket: los clientes se reconectan solos y los relojes de desconexión se restauran desde la base. Aun así, evita desplegar la API en mitad de partidas competitivas.
- Un cambio en `prisma/schema.prisma` se aplica solo al arrancar (`prisma db push --accept-data-loss`). Si el cambio borra columnas con datos, haz backup antes: [backup-y-restauracion](backup-y-restauracion.md).
- Mientras `capi-web` arranca, Traefik responde "no available server" unos segundos.
