# Capichan

Motor open source (MIT) de juegos de mesa de compraventa de propiedades. No es un clon: no usa nombres, reglas oficiales ni estilo visual de ningún juego comercial. Cada **mapa es un JSON** (nombres de calles, precios, imágenes, mazos de cartas, tema) y el motor es genérico, así que cambiar de mapa es cambiar de archivo.

Se juega **online**: el motor corre en el servidor (REST + WebSockets) y el cliente lo reutiliza para calcular qué acciones tienes disponibles y para las animaciones.

## Dos modos de juego

| Modo | Cómo se juega |
| --- | --- |
| **Clásico** | Turnos en orden. Solo el jugador activo puede tirar, comprar y terminar su turno. |
| **Async** | Todos juegan a la vez. Cada ficha tiene un **reloj de arena**: al terminar tu jugada arranca un cooldown (`asyncCooldownMs`) y cuando se agota puedes volver a tirar. Las subastas se cierran por tiempo (`auctionDurationMs`) o cuando todos pasan. |

El motor implementa ambos con el mismo código: cada jugador tiene una fase de turno (`idle | roll | act`) y el modo solo decide *quién* puede salir de `idle` (el orden de turnos, o el reloj de arena).

## Reglas configurables

El anfitrión las define en el lobby con el comando `SET_RULES`; al iniciar la partida quedan fijadas:

| Regla | Efecto |
| --- | --- |
| `isPublic` | La sala aparece en la lista de partidas públicas (`GET /api/games`) con jugadores actuales y máximo. |
| `competitive` | Modo competitivo: de 4 a 6 jugadores con cuenta, reglas tradicionales fijas (todas las demás opciones quedan bloqueadas) (hipoteca y subasta al rechazar sí; préstamos, compra de propiedades ajenas y subastas propias no), sin deudas (quien no puede pagar quiebra al instante), nadie entra a media partida, inactividad o desconexión de 120 s = bancarrota, duración fija de 2 horas y al acabar gana quien tenga más dinero; ese dinero suma al ranking global. |
| `maxDurationMs` | Límite de tiempo de la partida: 4 horas por defecto y como máximo (2 en competitivo). Al vencer gana el jugador con más dinero. Si nadie está conectado durante 30 minutos (`ABANDON_MS`), el servidor cierra la partida con el mismo criterio. |
| `afkTimeoutMs` | Tiempo por inactividad (0 = desactivado). Si un jugador no responde, el sistema tira los dados, decide al azar comprar o rechazar (rechaza directo si no le alcanza), termina el turno o declara la bancarrota por él; cada paso reinicia la cuenta. |
| `maxPlayers` | Asientos en la mesa (2 a 8). Quien llegue después entra como espectador. |
| `mortgageEnabled` | Hipotecar propiedades para conseguir dinero rápido; no cobran renta hasta pagarla (`mortgageInterest`). |
| `doubleRentOnMonopoly` | Con un grupo completo, la renta base (sin edificios) se duplica. Aplica también a transportes y servicios. |
| `noRentInJail` | Estando en la cárcel no cobras rentas. |
| `auctionOnly` | Toda propiedad libre solo se adquiere por subasta. |
| `auctionOnDecline` | Si el jugador no compra, la propiedad sale a subasta. |
| `playerAuctions` | Puedes subastar tus propias propiedades (`START_AUCTION` con puja mínima). |
| `buyOwnedProperties` | Comprar propiedades de otro jugador sin su consentimiento a `ownedPurchaseMultiplier` × precio. |
| `loansEnabled` | Pedir préstamos al banco (`maxLoan`); pagas `loanInterest` cada vez que pasas por la salida. |
| `tradingEnabled` | Negociar intercambios (dinero, propiedades, cartas de salir de la cárcel). |

Más: `startingCash`, `passStartBonus`, `landStartBonus` (total al caer exactamente en la salida), `jailFine`, `maxJailTurns`, `maxDoubles`, `maxBuildings`, `evenBuild`, `hotelUpgrades` (desactivada por defecto; activa en los presets Rápida y Moderna: con hotel en todas tus propiedades edificables puedes añadir hasta 4 pisos por hotel al precio de una construcción, y cada piso sube la renta del hotel un 35 %), `buildingSellRatio`, `asyncCooldownMs`, `auctionDurationMs`.

El anfitrión puede **forzar la jugada** de un jugador desde su menú (`FORCE_PLAY`): produce el mismo efecto que agotar el tiempo de inactividad (tirar, decidir la compra al azar o terminar el turno). Salir de una partida en curso declara la bancarrota de quien sale (`LEAVE`), y la interfaz lo avisa antes. Valores por defecto en `capi-core/src/engine/rules.ts`; cada tablero puede sobrescribirlos con `defaultRules`.

## Estructura

```
capi/
├─ capi-core/      Motor puro y determinista (TypeScript sin I/O). Lo comparten servidor y cliente.
│  ├─ src/board/   Esquema JSON del tablero, validación y geometría del anillo (tamaño dinámico).
│  ├─ src/engine/  Estado, comandos, eventos, reglas, reductor `apply()`, selectores para la UI.
│  ├─ boards/      Mapas de ejemplo: capi-city.json (40 casillas) y mini-harbor.json (24).
│  └─ test/        Tests del motor (vitest).
├─ capi-api/       Servidor Bun + Elysia + Prisma (SQLite). REST + WebSocket. Swagger en /docs.
└─ capi-frontend/  Cliente React 18 + Vite 6. Tablero, fichas y dados en 3D (Three.js, WebGPU con
                   fallback a WebGL) y un modo 2D en DOM puro (sin canvas ni WebGL) que se
                   intercambia desde el HUD. PWA instalable, solo online.
   ├─ src/three/   Escena imperativa: renderer, tablero, texturas de casilla, fichas, dados, cámara.
   ├─ src/components/game/Board2D.tsx y board2d/  Tablero 2D: componentes React y CSS, sin canvas.
   ├─ src/screens/ Inicio (crear o unirse, partidas públicas), lobby y sala (/room/:code). TanStack Router + Query.
   ├─ src/components/game/  HUD flotante, chips de jugadores, barra inferior de acciones, registro.
   ├─ src/components/dialogs/ Casilla, subastas, intercambios, préstamo, reglas.
   └─ public/boards/<mapa>/  Ilustraciones SVG de cada casilla de ubicación.
```

### Modos de tablero

El mismo estado y los mismos diálogos alimentan dos vistas intercambiables desde el botón del HUD (se recuerda en `capi:board-view`):

| Vista | Cómo se dibuja |
| --- | --- |
| **3D** | Three.js sobre WebGPU con fallback a WebGL (`src/three`). Incluye modos de cámara. |
| **2D** | Componentes React y CSS (`src/components/game/Board2D.tsx` y `board2d/`). Sin canvas, sin WebGL: cada casilla y cada ficha es un elemento del DOM, el anillo se calcula con `computeRingLayout` y el movimiento se anima casilla a casilla con transiciones CSS. Útil en equipos sin GPU, en sesiones remotas y como respaldo si el 3D falla. |

Ambas vistas comparten dados, cartas, registro, chat y hojas de propiedad; en 2D el botón de cámara se oculta porque no aplica.

Convenciones de UI: nada de emojis, solo iconos [Lucide](https://lucide.dev) (`icon` en el JSON es el nombre PascalCase del icono); las casillas de ubicación (propiedad, transporte, servicio) muestran siempre su `image`; layout flotante sin barra de navegación, controles en una barra inferior y registro a la derecha. Tailwind 4 para estilos y Motion para animaciones.

Principio central: **el motor es una función pura** `apply(board, state, command) → { state, events }`. El servidor la ejecuta y el cliente usa los mismos selectores para saber qué puede hacer cada jugador; el RNG está en el estado (semilla), así que todo es reproducible.

## Puesta en marcha

Requisitos: [Bun](https://bun.sh) ≥ 1.1.

```bash
bun install
bun run test            # tests del motor

# API (http://localhost:3000, docs en /docs)
cp capi-api/.env.example capi-api/.env
bun run db:setup        # prisma generate + db push (SQLite en capi-api/prisma/dev.db)
bun run dev:api

# Frontend (http://localhost:5173)
bun run dev:web
```

Sin `DATABASE_URL` la API arranca en memoria (útil para probar). Para mapas propios: pon tus JSON en una carpeta y define `CAPI_BOARDS_DIR`.

## Formato de mapa (JSON)

```jsonc
{
  "id": "mi-ciudad", "name": "Mi Ciudad", "version": 1,
  "currency": { "symbol": "₡" },
  "theme": { "background": "radial-gradient(...)", "accent": "#7c5cff" },
  "tokens": [{ "id": "gato", "label": "Gato", "icon": "Cat", "shape": "pawn" }],
  "defaultRules": { "startingCash": 1500 },
  "groups": [{ "id": "centro", "name": "Centro", "color": "#ff3b30", "houseCost": 100 }],
  "tiles": [
    { "id": "salida", "type": "start", "name": "Salida", "icon": "Rocket" },
    { "id": "calle-1", "type": "property", "name": "Calle Uno", "groupId": "centro",
      "price": 120, "rent": [10, 50, 150, 450, 625, 750], "mortgage": 60, "image": "https://..." },
    { "id": "est-1", "type": "transport", "name": "Estación", "groupId": "transport", "price": 200, "rent": [25, 50, 100, 200] },
    { "id": "luz", "type": "utility", "name": "Eléctrica", "groupId": "utility", "price": 150, "multipliers": [4, 10] },
    { "id": "tasa", "type": "tax", "name": "Impuesto", "amount": 200 },
    { "id": "carta-1", "type": "card", "name": "Fortuna", "deckId": "fortuna" },
    { "id": "carcel", "type": "jail", "name": "Cárcel" },
    { "id": "libre", "type": "free", "name": "Plaza" },
    { "id": "a-carcel", "type": "go-to-jail", "name": "A la cárcel" }
  ],
  "decks": [{ "id": "fortuna", "name": "Fortuna", "cards": [
    { "id": "f1", "text": "Cobra 100", "action": { "kind": "receive", "amount": 100 } }
  ]}]
}
```

Reglas del formato: el número de casillas debe ser **par y ≥ 8** (el anillo rectangular se calcula solo: 40 → 11×11, 24 → 7×7), la primera casilla es `start`, `rent` de una propiedad tiene 6 valores (base, 1–4 casas, hotel). Acciones de carta: `move-to`, `move-by`, `move-to-nearest`, `pay`, `receive`, `pay-each-player`, `receive-from-each-player`, `go-to-jail`, `jail-free`, `repairs`. `validateBoard()` devuelve la lista de problemas.

## API

REST (`/api`):

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/boards` · `/boards/:id` | Mapas disponibles / definición completa |
| POST | `/games` `{ boardId, mode, rules? }` | Crea una sala; `game.id` es el código para unirse |
| GET | `/games/:id` | Estado público + tablero |
| POST | `/games/:id/join` `{ name, color?, token? }` | Devuelve `playerId` y `secret`. Con `X-Account: Bearer <token>` vincula la cuenta al asiento |
| POST | `/games/:id/commands` (`Authorization: Bearer <secret>`) | Aplica un comando; errores `400 { error: { code, message } }` |

WebSocket `/ws/games/:id` (se entra como espectador; para jugar, primer mensaje `{ type: 'auth', secret }` tras conectar). Cliente → `{ type: 'command', requestId, command }`; servidor → `{ type: 'state', game, events }` tras cada comando de cualquiera, o `{ type: 'error', requestId, error }`.

## Desconexiones y anfitrión

- La partida vive en el servidor (SQLite) y cada jugador guarda su sesión en el navegador: si se cae la conexión o se recarga la página, el cliente reconecta solo y retoma en el mismo punto. Nadie pierde por quedarse sin internet; en modo async su reloj de arena sigue corriendo y en clásico la mesa espera.
- El servidor difunde por WebSocket quién está conectado (`{ type: 'presence', playerIds, offline }`); `offline` lleva, por cada jugador desconectado durante la partida, la hora límite para volver. Si no reconecta a tiempo (5 minutos; 2 en competitivo) queda en bancarrota (`FORFEITED` con motivo `disconnected`). El chip del jugador muestra la cuenta atrás y su menú también.
- Solo hay un anfitrión. Si alguien se fue para siempre, el anfitrión puede marcarlo en bancarrota (`REMOVE_PLAYER`) o ceder la anfitrionía (`TRANSFER_HOST`). Si el anfitrión abandona o quiebra, pasa automáticamente al siguiente jugador activo.
- Quien se une a una partida ya empezada entra como **espectador** (sin dinero ni ficha). El anfitrión puede sentarlo en la mesa (`SPAWN_PLAYER`, recibe el dinero inicial y sale desde la salida) o expulsarlo.
- Cada jugador puede cambiar nombre, color y ficha (`UPDATE_PLAYER`) en el lobby o durante la partida; el motor garantiza que no haya dos jugadores con el mismo color ni la misma ficha.
- Con la pestaña en segundo plano las animaciones no se acumulan: la escena 3D resuelve cada movimiento al instante mientras la pestaña está oculta y las cartas se dan por leídas, así que al volver se ve la mesa al día. Si la ausencia supera los 5 minutos, el cliente descarta cualquier animación pendiente y salta directamente al estado actual.

El tablero y el modo (clásico o async) se eligen en el lobby con `SET_BOARD` y `SET_MODE` (solo el anfitrión, antes de empezar); al cambiar de tablero se aplican sus reglas por defecto y las posiciones vuelven a la salida.

Comandos: `JOIN, LEAVE, SET_RULES, SET_MODE, SET_BOARD, START, REMOVE_PLAYER, TRANSFER_HOST, SPAWN_PLAYER, UPDATE_PLAYER, ROLL, BUY, DECLINE, END_TURN, PAY_JAIL_FINE, USE_JAIL_CARD, BUILD, SELL_BUILDING, MORTGAGE, UNMORTGAGE, BID, PASS_AUCTION, START_AUCTION, BUY_OWNED, BORROW, REPAY, PROPOSE_TRADE, ACCEPT_TRADE, DECLINE_TRADE, CANCEL_TRADE, BANKRUPT, TICK`.

El estado público no incluye la semilla del RNG ni el orden de los mazos: nadie puede predecir dados ni cartas. Un ticker en el servidor cierra subastas vencidas y renueva relojes de arena aunque nadie envíe comandos.

## Chat en vivo y chat de voz

- **Chat de texto** por WebSocket (`{ type: 'chat', text }` → difusión `{ type: 'chat', message }`; al conectar llega `chat-history`). Se guardan los últimos 200 mensajes por sala en la columna `chat` de `Game`. Límite de 500 caracteres y un mensaje cada 400 ms por jugador. El panel va abajo a la izquierda (abierto por defecto en escritorio, hoja deslizable en móvil): los enlaces a imágenes o GIF se muestran como imagen con visor a pantalla completa, el resto como enlace; hay autoscroll con aviso de "Nuevos mensajes".
- **GIFs**: `GET /api/gifs?q=` hace de proxy de Tenor y necesita `TENOR_API_KEY` (gratuita en Google Cloud). Sin clave, el selector permite pegar enlaces. Los favoritos (estilo stickers) se guardan en el navegador.
- **Chat de voz**: WebRTC en malla entre navegadores; el servidor solo reenvía la señalización (`{ type: 'rtc', to, payload }`). `GET /api/rtc/config` entrega los servidores ICE: STUN públicos de Google por defecto (`STUN_URLS`) y, si se configuran, un TURN (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`). Sin TURN, dos jugadores detrás de NAT estrictas o redes corporativas pueden no oírse; para producción conviene un TURN propio (coturn) o un servicio gestionado. Controles: botón de micrófono en el dock (activar, silenciar; clic derecho abre Ajustes → Audio), pestaña Audio con dispositivo de entrada, volumen general y medidor, y en el menú de cada jugador silenciar o ajustar su volumen.

## Intercambios

El modal de intercambio (`components/dialogs/TradeSheet.tsx`) tiene dos columnas: lo que ofreces y lo que pides. El dinero se elige con un deslizador a todo el ancho o escribiendo la cifra al pulsar sobre el importe grande; siempre se recorta a un entero entre 0 y el efectivo real de cada jugador, y el motor vuelve a validarlo (`INSUFFICIENT_FUNDS`, `INVALID_COMMAND`). Las propiedades aparecen en una lista compacta con imagen, bandera o color del grupo, nombre, precio y estado (hipotecada, con construcciones, que no se pueden negociar). La misma vista sirve para ver una propuesta: quien la recibe puede aceptar o rechazar, quien la hizo puede cancelarla y el resto solo mira. En el dock, junto al registro, un botón despliega los intercambios en curso (quién propone, a quién y un resumen) y permite abrir cualquiera o crear uno nuevo.

## Pantalla de inicio

El inicio es un explorador de mesas: una tabla con todas las partidas públicas (código, tablero, modo, preset de reglas, anfitrión y plazas) con buscador y filtros (Clásico, Async, Competitivo, En curso, solo con plazas). Escribir un código privado en el buscador y pulsar Enter entra en esa sala. A la derecha va tu jugador (cuenta, dinero total, victorias/derrotas, última sala), dos rankings (victorias, contando solo acabar primero, y dinero) y la suscripción CEO. No hay campo de nombre: los invitados reciben un nombre `Invitado NNN` recordado en el navegador y lo cambian en el lobby. `GET /api/leaderboard` devuelve `entries` (por dinero) y `wins` (por victorias, desempate por menos derrotas), cada entrada con `wins` y `losses`. `GET /api/games` devuelve por cada mesa `preset` (nombre del preset que coincide o `null`) y `boardAccent` (color del tablero).

El inicio, el lobby, la pantalla de unirse a una sala, la de partida terminada y las vistas de carga y error usan el tema limpio claro/oscuro (`.theme-clean` en `<html>`, tokens en `styles/app.css`); el botón de tema cicla automático → claro → oscuro y guarda la elección en el navegador. El lobby separa la columna derecha en dos pestañas: **Partida** (tablero, modo, competitivo) y **Ajustes** (presets y reglas). La partida conserva el estilo de cristal. La tipografía de toda la app es Nunito (variable, empaquetada con `@fontsource-variable/nunito`).

## Cuentas, ranking y suscripción CEO

Se puede jugar como invitado (solo nombre) o con cuenta. La cuenta se crea con el correo y un código de un solo uso:

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/request-code` `{ email }` | Envía un código de 6 dígitos por correo (Resend). Caduca en 10 min, 5 intentos. |
| POST | `/api/auth/verify` `{ email, code, name? }` | Devuelve `{ token, user }`. El token dura 90 días. |
| GET | `/api/auth/me` · PATCH `/api/auth/me` `{ name }` · POST `/api/auth/logout` | Cuenta actual (cabecera `X-Account: Bearer <token>`). |
| GET | `/api/leaderboard` | Top 50 de cuentas por dinero total (`{ entries: [{ rank, name, totalCash, gamesPlayed }] }`). |
| GET | `/api/billing/status` · POST `/api/billing/checkout` · POST `/api/billing/portal` | Suscripción CEO (6 USD/mes) vía Stripe Checkout y portal de facturación. |
| POST | `/api/billing/webhook` | Webhook de Stripe (firma verificada) que activa o cancela el acceso CEO. |
| POST | `/api/billing/dev-activate` | Solo fuera de producción: concede 30 días de CEO para probar. |

- Al unirte a una sala envía `X-Account: Bearer <token>` para vincular tu cuenta al asiento. Las partidas **competitivas** rechazan invitados (`403 ACCOUNT_REQUIRED`).
- El catálogo (`TOKEN_CATALOG`) tiene 23 fichas libres (capibara, tucán, cactus, volcán, barco, guitarra, mate, cometa, tortuga, pulpo, cohete, sombrero, pingüino, caballo, cybertruck, stickman, torres, paloma, moto, Fórmula 1, rata, cubo y pirámide) y 6 premium; cada una tiene un icono Lucide para la interfaz y un modelo 3D procedural en `capi-frontend/src/three/pieces/`.
- Las 6 fichas premium del catálogo (`premium: true`) solo pueden elegirlas cuentas con CEO activo (`403 PREMIUM_REQUIRED`).
- **Ranking**: al terminar una partida **pública y competitiva**, el dinero final de cada cuenta sentada se suma a su total global (una sola vez por partida; los invitados no puntúan).
- **Competitivo**: reglas tradicionales fijas, sin préstamos ni compras forzadas, sin deudas (quien no puede pagar quiebra), nadie entra a media partida, 120 s de inactividad o de desconexión → bancarrota, 2 h fijas y al acabar gana quien tenga más dinero.

Variables de entorno de la API (`capi-api/.env`):

| Variable | Uso |
| --- | --- |
| `RESEND_API_KEY`, `RESEND_FROM` | Envío de códigos. Sin clave, el código se imprime en la consola y, fuera de producción, se devuelve como `devCode`. |
| `AUTH_PEPPER` | Secreto con el que se hashean los códigos. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Suscripción CEO. Sin ellas, checkout y portal responden `503 BILLING_NOT_CONFIGURED` y queda `dev-activate` para probar. |
| `APP_URL` | URL del frontend para las redirecciones de Stripe. |
| `CORS_ORIGINS` | Orígenes permitidos separados por comas (por defecto `http://localhost:5173`). |
| `DISCONNECT_FORFEIT_MS` | Tiempo sin conexión antes de la bancarrota en competitivo (120000). |
| `DISCONNECT_GRACE_MS` | Tiempo sin conexión antes de la bancarrota en el resto de partidas (300000, 5 minutos). |
| `TENOR_API_KEY` | Búsqueda de GIFs en el chat. Sin clave, solo se pueden pegar enlaces. |
| `STUN_URLS`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Servidores ICE para el chat de voz. STUN de Google por defecto; TURN opcional pero recomendable en producción. |

Seguridad: límites de peticiones en memoria (códigos: 5 por correo y 10 por IP cada 10 min; verificación 10 por IP; crear sala 20 por IP), cuerpo máximo de 64 KB, mensajes WebSocket de 16 KB, lista blanca de comandos (el cliente nunca puede enviar `FORFEIT` ni fijar `playerId`), cabeceras de seguridad y sin trazas en las respuestas. `/docs` solo existe fuera de producción.

## Licencia

MIT. Los mapas de ejemplo, nombres y cartas son originales de este proyecto.
