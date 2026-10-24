# Backup y restauración

## Backup

Automático cada día a las 04:17 por cron. A mano:

```bash
/root/cityboard/deploy/backup-db.sh
ls -lt /root/backups/capichan | head
```

Usa `VACUUM INTO` dentro del contenedor (seguro con WAL), copia el archivo, lo comprime y deja los 14 más recientes. Variables: `CAPI_BACKUP_DIR`, `CAPI_BACKUP_KEEP`, `CAPI_CONTAINER`.

**No copiar `capi.db` a mano con `cp`**: con WAL activo la copia puede quedar incompleta.

Log del cron: `/var/log/capichan-backup.log`.

## Comprobar que un backup sirve

```bash
gunzip -c /root/backups/capichan/capi-AAAAMMDD-HHMMSS.db.gz > /tmp/prueba.db
docker cp /tmp/prueba.db capi-api:/tmp/prueba.db
docker exec capi-api sh -c 'cd /app/capi-api && bun -e "
const { createClient } = require(\"@libsql/client\");
const c = createClient({ url: \"file:/tmp/prueba.db\" });
c.execute(\"select count(*) as n from Game\").then((r) => { console.log(\"partidas:\", r.rows[0].n); process.exit(0); });"'
docker exec capi-api rm -f /tmp/prueba.db
```

## Restaurar

Corta todas las partidas en curso.

```bash
cd /root/cityboard
./deploy/backup-db.sh                                  # copia del estado actual por si acaso
gunzip -c /root/backups/capichan/capi-ELEGIDO.db.gz > /tmp/restaurar.db
docker compose stop capi-api
docker run --rm -v cityboard_capi-data:/data -v /tmp:/src alpine sh -c 'rm -f /data/capi.db-wal /data/capi.db-shm && cp /src/restaurar.db /data/capi.db'
docker compose start capi-api
```

Después: [verificar](verificar.md#smoke).
