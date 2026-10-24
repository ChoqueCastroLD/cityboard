# Producción

## Dónde vive

- VPS compartido con otros proyectos. El checkout de despliegue es `/root/cityboard`.
- El puerto 80/443 es del Traefik de Coolify (`coolify-proxy`). Los contenedores no publican puertos: se unen a la red externa `coolify` y se anuncian con labels.
- URL: https://capichan.com/monopoly. Traefik: `Host(capichan.com) && PathPrefix(/monopoly)` con middleware `stripprefix`. La raíz es de otro proyecto; Traefik da más prioridad a la regla más larga, así que no chocan.
- DNS en Cloudflare con proxy. `www.capichan.com` **no tiene registro**; meterlo en un router de Traefik rompe la emisión del certificado de todo el dominio.

## Contenedores (`docker-compose.yml`)

| Servicio | Imagen | Notas |
| --- | --- | --- |
| `capi-api` | `Dockerfile.api` | Bun, `prisma db push` al arrancar, volumen `capi-data:/data`, healthcheck `/api/health` |
| `capi-web` | `Dockerfile.web` | Build Vite + nginx (`deploy/nginx.conf`), proxy de `/api/` y `/ws/` a `capi-api:3000`, fallback SPA |

## Variables

Viven en `/root/cityboard/.env` (gitignorado, permisos 600) y se pasan al contenedor desde el compose. Ver `capi-api/.env.example` para la lista completa.

| Variable | Valor en producción |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `file:/data/capi.db` |
| `APP_URL` | `https://capichan.com/monopoly` (retornos de Stripe) |
| `AUTH_PEPPER` | aleatorio, en `.env` |
| `RESEND_API_KEY`, `RESEND_FROM` | en `.env`; remitente `Capichan <acceso@capichan.com>`, dominio verificado en Resend |
| `STRIPE_*`, `TENOR_API_KEY`, `TURN_*` | sin configurar |

Build del frontend: `VITE_API_URL=/monopoly` en `Dockerfile.web`.

## Tareas programadas (crontab de root)

- `17 4 * * *` `deploy/backup-db.sh`: copia con `VACUUM INTO`, gzip, rotación de 14, en `/root/backups/capichan`.
- `*/5 * * * *` `deploy/watchdog.sh`: reinicia `capi-api` o `capi-web` si Docker los marca `unhealthy`.

## Herramientas en el VPS

- No hay Bun en el host: tests y typecheck se corren en un contenedor `oven/bun:1-debian` montando el repo, o dentro de `capi-api`.
- Para QA visual hay contenedores browserless (puertos 13000-13004). El token está en la variable `TOKEN` de cada contenedor y cambia al reiniciarlos.
- `gh` autenticado para pushear a `main`.

## ads.txt

`capi-frontend/public/ads.txt` se sirve en `/monopoly/ads.txt`. AdSense lo lee de la raíz, así que el `ads.txt` de la raíz lo debe servir el proyecto que ocupa `/`.
