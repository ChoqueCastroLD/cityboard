# Documentación de Capichan Monopoly

Dos carpetas:

- [`knowledge/`](knowledge/): qué es el proyecto, cómo está construido, por qué se tomaron las decisiones y qué se aprendió. Léelo antes de tocar código.
- [`runbook/`](runbook/): procesos operativos, cada uno independiente y ejecutable de principio a fin.

El [README de la raíz](../README.md) sigue siendo la referencia de reglas del juego, formato de mapas y API.

## Conocimiento

| Archivo | Tema |
| --- | --- |
| [01-producto-y-reglas](knowledge/01-producto-y-reglas.md) | Qué es, nombre, reglas fijas del dueño |
| [02-arquitectura](knowledge/02-arquitectura.md) | Monorepo, paquetes, flujo de datos |
| [03-motor](knowledge/03-motor.md) | capi-core: estado, comandos, eventos, tick |
| [04-servidor](knowledge/04-servidor.md) | capi-api: REST, WebSocket, persistencia, seguridad |
| [05-frontend](knowledge/05-frontend.md) | capi-frontend: pantallas, cliente, ruta base, PWA |
| [06-tablero-2d](knowledge/06-tablero-2d.md) | Vista 2D en DOM: diseño, animaciones, encuadre |
| [07-produccion](knowledge/07-produccion.md) | VPS, Traefik, dominio, variables, crons |
| [08-lecciones](knowledge/08-lecciones.md) | Bugs encontrados y lo que enseñaron |
| [09-pendientes](knowledge/09-pendientes.md) | Lo que falta, por prioridad |

## Runbook

| Proceso | Cuándo |
| --- | --- |
| [desplegar](runbook/desplegar.md) | Subir cambios a producción |
| [verificar](runbook/verificar.md) | Tests, typecheck y smoke antes y después de desplegar |
| [partida-de-prueba](runbook/partida-de-prueba.md) | Crear una partida en curso para probar |
| [qa-visual](runbook/qa-visual.md) | Capturas y pruebas en navegador real |
| [rollback](runbook/rollback.md) | Volver a la versión anterior |
| [caida-o-errores](runbook/caida-o-errores.md) | La web o la API no responden |
| [backup-y-restauracion](runbook/backup-y-restauracion.md) | Copias de la base y cómo restaurarlas |
| [certificado-tls](runbook/certificado-tls.md) | El certificado no se emite o caduca |
| [secretos-e-integraciones](runbook/secretos-e-integraciones.md) | Añadir o rotar claves (Resend, Stripe, Tenor, TURN) |
| [probar-correo](runbook/probar-correo.md) | Comprobar que llegan los códigos de acceso |
| [cambiar-ruta-o-dominio](runbook/cambiar-ruta-o-dominio.md) | Mover el juego a otra ruta o dominio |
| [commits](runbook/commits.md) | Convenciones de commit y push |
