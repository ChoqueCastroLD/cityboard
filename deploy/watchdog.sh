#!/bin/sh
# Reinicia los contenedores de Capichan si docker los marca unhealthy.
set -eu

for name in capi-api capi-web; do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo missing)
  case "$status" in
    unhealthy)
      echo "[watchdog] $(date -Is) $name unhealthy -> restart"
      docker restart "$name" >/dev/null
      ;;
    missing)
      echo "[watchdog] $(date -Is) $name no existe"
      ;;
  esac
done
