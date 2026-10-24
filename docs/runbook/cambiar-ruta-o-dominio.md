# Cambiar ruta o dominio

El juego vive en `/monopoly`. Para moverlo a otra ruta (`/NUEVA`) o a otro dominio hay que tocar cinco sitios a la vez.

| Archivo | Qué cambiar |
| --- | --- |
| `capi-frontend/vite.config.ts` | `base: '/NUEVA/'` |
| `Dockerfile.web` | `ENV VITE_API_URL="/NUEVA"` |
| `capi-frontend/public/manifest.webmanifest` | `id`, `start_url`, `scope` y `src` de los iconos |
| `docker-compose.yml` | regla `PathPrefix(/NUEVA)` en ambos routers, `stripprefix.prefixes=/NUEVA`, `APP_URL` |
| `capi-frontend/public/sw.js` | subir el nombre de `CACHE` para invalidar lo cacheado |

El router (`basepath: import.meta.env.BASE_URL`), el service worker (toma la base de su `scope`), `rebase()` de las imágenes y el enlace de invitación se ajustan solos a partir de `base`.

Para servir en la raíz de un dominio: `base: '/'`, `VITE_API_URL=""`, quitar el `PathPrefix` y el middleware `stripprefix`.

Para otro dominio: cambiar `Host(...)` en las reglas, `APP_URL`, `CORS_ORIGINS`, y crear el registro DNS **antes** de desplegar o el certificado fallará ([certificado-tls](certificado-tls.md)).

## Después

1. [desplegar](desplegar.md) con `docker compose up -d --build`.
2. Comprobar: `/NUEVA/`, `/NUEVA/room/X`, `/NUEVA/api/health`, una imagen `/NUEVA/boards/america/caracas.jpg`.
3. [qa-visual](qa-visual.md) en una partida: imágenes, WebSocket, tirada.
4. Si la ruta anterior queda libre para otro proyecto, avisar de que los navegadores pueden tener el service worker viejo y que ese proyecto debería servir un `sw.js` que se desregistre.
