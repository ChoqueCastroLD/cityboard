# Probar correo

Envía un código de acceso real y comprueba la entrega.

1. Pedir el código (usa un correo propio):
   ```bash
   curl -s -X POST https://capichan.com/monopoly/api/auth/request-code \
     -H 'content-type: application/json' -d '{"email":"TU_CORREO"}'
   ```
   Esperado: `{"sent":true}`.
2. Ver el estado en Resend (la clave está en `/root/cityboard/.env`):
   ```bash
   KEY=$(sed -n 's/^RESEND_API_KEY=//p' /root/cityboard/.env)
   curl -s -H "Authorization: Bearer $KEY" 'https://api.resend.com/emails?limit=1'
   ```
   `last_event` debe ser `delivered`.
3. Canjear el código para probar el flujo completo:
   ```bash
   curl -s -X POST https://capichan.com/monopoly/api/auth/verify \
     -H 'content-type: application/json' -d '{"email":"TU_CORREO","code":"123456","name":"Prueba"}'
   ```
   Devuelve `token` y `user`.

Límites: 5 códigos por correo y 10 por IP cada 10 minutos. Si sale `RATE_LIMITED`, esperar.

Si `mail: console` aparece en el arranque, la clave no está cargada: [secretos-e-integraciones](secretos-e-integraciones.md).
