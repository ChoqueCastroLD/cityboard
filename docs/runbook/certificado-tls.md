# Certificado TLS

Traefik pide el certificado a Let's Encrypt (resolver `letsencrypt`) para `capichan.com`. Cloudflare está delante con proxy.

## Comprobar

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername capichan.com 2>/dev/null | openssl x509 -noout -issuer -enddate
```

- `issuer=... Let's Encrypt` → bien.
- `TRAEFIK DEFAULT CERT` → no se emitió.

## Si no se emite

1. Ver por qué:
   ```bash
   docker logs --since 1h coolify-proxy 2>&1 | grep -i 'capichan' | tail
   ```
2. Causas conocidas:
   - Un dominio sin DNS en el router (por ejemplo `www.capichan.com`). Quitarlo de la regla en `docker-compose.yml` y `docker compose up -d capi-web`.
   - Rate limit `429 too many failed authorizations`: esperar la hora que indica el log; no seguir reintentando.
3. Esperar a que aparezca:
   ```bash
   until echo | openssl s_client -connect 127.0.0.1:443 -servername capichan.com 2>/dev/null | openssl x509 -noout -issuer | grep -q "Let's Encrypt"; do sleep 10; done
   ```

Mientras no haya certificado, https sigue funcionando para usuarios porque Cloudflare termina TLS; solo fallaría con Cloudflare en modo Full (strict).

La raíz del dominio la sirve otro proyecto con su propio router; el certificado puede salir de cualquiera de los dos routers.
