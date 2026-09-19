#!/bin/sh
# Copia consistente de la base de Capichan usando VACUUM INTO (seguro con WAL).
set -eu

CONTAINER="${CAPI_CONTAINER:-capi-api}"
DEST="${CAPI_BACKUP_DIR:-/root/backups/capichan}"
KEEP="${CAPI_BACKUP_KEEP:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

docker exec "$CONTAINER" sh -c "rm -f /tmp/backup.db && cd /app/capi-api && bun -e \"const{createClient}=require('@libsql/client');const c=createClient({url:'file:/data/capi.db'});c.execute(\\\"VACUUM INTO '/tmp/backup.db'\\\").then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})\""
docker cp "$CONTAINER:/tmp/backup.db" "$DEST/capi-$STAMP.db"
docker exec "$CONTAINER" rm -f /tmp/backup.db
gzip -f "$DEST/capi-$STAMP.db"

ls -1t "$DEST"/capi-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[backup] $DEST/capi-$STAMP.db.gz ($(du -h "$DEST/capi-$STAMP.db.gz" | cut -f1))"
