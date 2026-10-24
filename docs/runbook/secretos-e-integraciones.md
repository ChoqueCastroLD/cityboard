# Secretos e integraciones

Todas las claves viven en `/root/cityboard/.env` (gitignorado, `chmod 600`). Nunca en el repo, en commits ni en la documentación.

## Añadir o rotar una clave

1. Editar `/root/cityboard/.env`.
2. Si la variable es nueva, añadirla al bloque `environment` de `capi-api` en `docker-compose.yml`:
   ```yaml
   NUEVA_VARIABLE: "${NUEVA_VARIABLE}"
   ```
3. Recrear la API: `docker compose up -d capi-api`.
4. Confirmar en el log de arranque:
   ```bash
   docker logs capi-api 2>&1 | grep listening
   ```
   La línea dice `mail: resend` o `mail: console`, y `billing: stripe` o `billing: not configured`.

## Integraciones

| Servicio | Variables | Estado | Cómo probar |
| --- | --- | --- | --- |
| Resend (correo) | `RESEND_API_KEY`, `RESEND_FROM` | activo, dominio `capichan.com` verificado | [probar-correo](probar-correo.md) |
| Stripe (CEO) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | sin configurar | checkout, portal y webhook; `APP_URL` ya apunta a `/monopoly` |
| Tenor (GIFs) | `TENOR_API_KEY` | sin configurar | buscar un GIF en el chat |
| TURN (voz) | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | sin configurar | voz entre dos redes distintas |
| Pepper de auth | `AUTH_PEPPER` | aleatorio | rotarlo invalida todas las sesiones de cuenta |

Para Stripe, el webhook debe apuntar a `https://capichan.com/monopoly/api/billing/webhook`.
