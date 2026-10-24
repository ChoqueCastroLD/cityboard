# Lecciones

Bugs reales encontrados en producción o en QA, con la causa y lo que enseñan.

| Síntoma | Causa | Lección |
| --- | --- | --- |
| Jugador queda de espectador al entrar | El `auth` llegaba antes de que el `open` asíncrono registrara la conexión | Registrar estado de conexión antes del primer `await`; el smoke lo prueba enviando `auth` en `onopen` |
| Frames con un número suelto (`101`) en el WS | `return ws.send(...)` en Elysia envía el valor de retorno | En handlers WS, `send` y luego `return` vacío |
| Certificado por defecto de Traefik | `www` sin DNS en el mismo router hacía fallar la orden entera y luego rate limit 429 | Solo dominios con DNS en los routers; mirar `docker logs coolify-proxy` |
| Pellizco tumba la partida ("Algo salió mal") | Actualizador de estado leía una ref anulada al levantar un dedo | Capturar valores en locales antes de `setState(fn)` |
| Tooltips fantasma apilados en 2D | Hover en cada `mousemove` + `key` por casilla en `AnimatePresence` | Una instancia con `key` fija; solo `mouseenter`/`mouseleave` |
| Animación 2D podía perder eventos | `walk` dependía del estado y re-suscribía el listener en cada paso | Valores que cambian en animación van en refs |
| Nombre de casilla desaparece en laterales | Span con `-webkit-box` se encogía como ítem flex | `shrink-0` en el texto, la imagen es la que cede |
| Tablero se sale de la pantalla | `getBoundingClientRect` incluye padding | Medir un contenedor sin padding |
| Última fila de hojas ilegible en móvil | Dock translúcido detrás del glass | Diálogos opacos en móvil |
| Partida de prueba "terminada" a los minutos | Abandono: sin nadie conectado 30 min, o AFK autoplay | Crear partidas con `afkTimeoutMs: 0` y una nueva por prueba |
| Pruebas headless ven pantalla de "unirse" | Sin `capi:session` en localStorage el visitante no está en la partida | Inyectar la sesión con `evaluateOnNewDocument` |
| Tooltips imposibles de probar en headless | El navegador reporta `hover: none` y la emulación no funciona en este browserless | Verificar a mano con ratón real |
| 3D en headless no llega a `networkidle2` | El render loop mantiene actividad | Usar `domcontentloaded` + espera fija, o revisar logs de nginx |
| Hook condicional | `useTouch() \|\| usePhone()` | Llamar todos los hooks siempre |

## Sobre SQLite

Se evaluó migrar a Postgres. Conclusión: no hace falta mientras haya un solo proceso; el estado es un blob JSON. Lo que sí era necesario era WAL y `busy_timeout`. Migrar tiene sentido si se quieren varias instancias de API (hoy imposible por el estado en memoria) o backups gestionados; el cambio sería el `provider` de Prisma, no reescribir la capa de datos.
