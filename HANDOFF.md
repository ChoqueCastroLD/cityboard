# Handoff · Capi

Documento de traspaso del proyecto al 17 de septiembre de 2026. Resume qué es Capi, cómo está construido, qué decisiones de producto y diseño se tomaron, cómo se verifica y qué queda pendiente. El README cubre el detalle técnico de cada módulo; este archivo cubre el contexto.

## 1. Qué es

Capi es un juego de mesa en línea tipo "compra propiedades y cobra rentas", de código abierto (MIT), con motor propio y mapas definidos en JSON. No usa nombres, reglas literales ni estética de ninguna marca registrada: los tableros, cartas y fichas son originales. La interfaz está en español.

- Repositorio: https://github.com/ChoqueCastroLD/cityboard (rama `main`).
- Dominio registrado: capichan.com (17/09/2026). El rebrand a Capichan todavía no está hecho en el código; todo sigue diciendo "Capi".
- Nombres considerados: Capitalia, Rento, Capichan, Monochan. Se descartó "Capipolio" por el sufijo "-opoly" y su riesgo legal.

## 2. Stack y estructura

Monorepo con bun workspaces. Bun 1.4, TypeScript estricto.

| Paquete | Qué contiene |
| --- | --- |
| `capi-core` | Motor puro: `apply(board, state, command) → { state, events }`, RNG con semilla, reglas, presets, selectores. Tests con vitest (29). |
| `capi-api` | Bun + Elysia + Prisma (SQLite vía adaptador libsql; `queryCompiler` + `driverAdapters` porque el motor nativo de Prisma falla en Bun/Windows). REST + WebSocket, cuentas por código de correo, ranking, suscripción CEO (Stripe), chat, señalización de voz, proxy de GIFs. Tests con `bun test` (8). |
| `capi-frontend` | React 18, Vite 6, TanStack Router y Query, Tailwind 4, Motion, Lucide, Three.js con WebGPU (fallback WebGL). PWA. |

Carpetas clave del frontend: `src/screens` (Home, Room con lobby y partida), `src/components/{game,dialogs,chat,home,account,ui}`, `src/three` (escena imperativa: renderer, tablero, texturas de casilla, fichas, dados, cámara, piezas procedurales), `src/lib`, `src/hooks`, `src/client` (cliente REST + WS).

Arranque local: `bun install`, `cd capi-api && cp .env.example .env && bun run db:setup && bun run dev`, y `bun run --cwd capi-frontend dev`. API en :3000, web en :5173. Sin `DATABASE_URL` la API usa memoria.

## 3. Conceptos del motor

- Estado inmutable por comando (`structuredClone`), eventos tipados, `TICK` para procesos temporales (relojes de arena, subastas, inactividad, abandono, límite de tiempo).
- Modos: **Clásico** (turnos) y **Async** (cada ficha tiene un reloj de arena; todos juegan a la vez).
- Reglas configurables con presets Rápida, Clásica, Moderna y Larga; se fijan al empezar. Incluyen hipoteca, renta doble, sin renta en cárcel, solo subastas, subasta al rechazar, subastas de jugadores, comprar propiedades ajenas, préstamos, intercambios, construir parejo, **mejora de hoteles** (hasta 4 pisos, +35 % renta cada uno; activa en Rápida y Moderna), tiempo por inactividad, jugadores máximos, duración máxima (tope 4 h; gana el más rico).
- **Competitivo**: 4 a 6 jugadores con cuenta, reglas oficiales fijas, 2 h, sin entradas a media partida, inactividad o desconexión de 120 s → bancarrota, dinero final al ranking. Partida pública obligatoria.
- Anfitrión único con traspaso; espectadores que se unen a media partida y el anfitrión puede sentar o expulsar; `FORCE_PLAY` (el anfitrión fuerza la jugada de otro, mismo efecto que agotar la inactividad); `LEAVE` en partida = bancarrota; `finalCash` conserva el dinero con el que alguien quebró.
- Catálogo de 29 fichas (23 libres y 6 premium CEO) en `capi-core/src/board/tokens.ts`, cada una con icono Lucide y modelo 3D en `capi-frontend/src/three/pieces`.
- Tableros: Capi City, Mini Harbor, Mundo Clásico y América (`capi-core/boards/*.json`, imágenes y atribuciones en `capi-frontend/public/boards`).

## 4. Servidor

- Cola de comandos por partida, historial de 150 eventos persistido, presencia por WS con plazos de desconexión (`offline` en el mensaje `presence`): 5 minutos de gracia (2 en competitivo) y luego bancarrota.
- Abandono: partida en curso sin nadie conectado 30 min → se termina.
- Cuentas: código de 6 dígitos por correo (Resend; sin clave se imprime en consola y se devuelve `devCode` fuera de producción), token `X-Account: Bearer`, invitados permitidos.
- Ranking: `entries` por dinero y `wins` por victorias (columnas `wins`/`losses` en `User`); solo partidas públicas competitivas.
- CEO: Stripe checkout, portal y webhook detrás de variables de entorno; `POST /api/billing/dev-activate` para probar sin Stripe.
- Chat: mensajes por WS, últimos 200 por sala en la columna `chat` de `Game`, 500 caracteres, 1 mensaje cada 400 ms. GIFs vía Tenor (`TENOR_API_KEY`).
- Voz: WebRTC en malla, el servidor solo reenvía `rtc`; `GET /api/rtc/config` con STUN de Google y TURN opcional.
- Seguridad: límites de peticiones en memoria, cuerpo máximo 64 KB, WS 16 KB, lista blanca de comandos, cabeceras de seguridad. Sin TLS propio (se asume un proxy delante en producción).

## 5. Frontend y decisiones de diseño

- **Estilo**: Apple limpio (blanco, sin bordes en tarjetas, hairlines, azul de acción) en inicio, lobby, unirse, terminada, carga y error, con tema claro/oscuro (`.theme-clean` en `<html>`, sigue `prefers-color-scheme`, botón de tema con automático/claro/oscuro guardado en el navegador). **La partida conserva el liquid glass oscuro a propósito**: el usuario lo prefiere así.
- Tipografía: Fredoka para marca, títulos, titulares y el nombre en el centro del tablero; Nunito para el cuerpo. Ambas empaquetadas con fontsource. La app espera a las fuentes antes del primer render para evitar saltos.
- Reglas fijas del usuario: **nunca emojis como iconos** (solo Lucide), **nunca comentarios en el código**, imágenes reales en casillas de lugares, sin modo offline, nada de marcas registradas.
- Inicio: explorador de mesas (tabla con código, tablero, modo, preset, anfitrión, plazas; buscador; filtros; entrar con código privado), enlace "Volver a la sala", dos rankings, fila CEO. Sin campo de nombre: los invitados reciben `Invitado NNN` y lo cambian en el lobby.
- Lobby: cabecera con tema, código, "Enlace para unirse" (Web Share o portapapeles), empezar/esperando y salir; jugadores a la izquierda (tu fila con "Tú" y anillo de color; al pulsarla se edita nombre, color y ficha) y chat inline debajo; a la derecha pestañas Partida (tablero, modo, presets rápidos, competitivo) y Ajustes (reglas). Ambas columnas llenan la misma altura.
- Partida: HUD flotante sin barra, chips de jugadores arriba a la izquierda (con cuenta atrás de desconexión, tachado y dinero final si quebró, indicador de voz), registro en vivo a la derecha, dock abajo a la derecha (acciones, tiempo restante del rival, micrófono, intercambios, chat en móvil, registro), chat abajo a la izquierda abierto por defecto (colapsado muestra mensajes flotantes 30 s), titulares arriba, dados 2D sincronizados con los 3D, revelado de carta con cuenta atrás, Ajustes por pestañas (Reglas, Audio).
- 3D: tablero en anillo, tarjetas de casilla que giran en pasos de 90° hacia la cámara (diseño horizontal en los laterales, banda de color hacia fuera), nombres largos que se ajustan, renta en la casilla cuando tiene dueño, sin tinte de grupo cuando hay casas, hoteles con pisos apilados, fichas que miran hacia donde caminan, cámara con modos mapa/jugador/bloqueada (en móvil arranca en "jugador"), animaciones que siguen en segundo plano y salto directo al estado tras 5 minutos ocultos.
- Intercambios: modal grande con dinero por deslizador o importe editable (acotado a 0..efectivo), lista de propiedades con imagen, bandera, precio y estado; misma vista para aceptar/rechazar/cancelar; dropdown de intercambios en curso en el dock.
- Paleta de jugadores: 13 colores distinguibles (rojo, azul, verde, amarillo, naranja, púrpura, rosa, celeste, limón, menta, marrón, negro, blanco) con iconos que eligen blanco o negro por contraste.

## 6. Cómo verificar

- `bun run --cwd capi-core test`, `cd capi-api && NODE_ENV=test bun test`, `bun run typecheck` en cada paquete, `bun run --cwd capi-frontend build`.
- Pruebas visuales con el navegador headless de gstack (`~/.claude/skills/gstack/browse/dist/browse`: `goto`, `js`, `screenshot`, `viewport`). Se probaron inicio, lobby y partida a 1280×720, 834×1112 y 390×844.
- `capi-frontend/scene-dev.html` es un harness de la escena 3D (`?gallery` muestra las 29 fichas; expone `window.__scene`).
- Los scripts de humo REST/WS usados en la sesión no están en el repo (vivían en un scratchpad temporal); conviene recrearlos en `capi-api/scripts` si se quieren mantener.

## 7. Pendiente

Bloqueado por claves o decisiones del dueño:

1. **Rebrand** a Capichan (o el nombre final): interfaz, `<title>`, manifest y iconos de la PWA, correos de acceso, README, nombre del repositorio.
2. **Resend**: poner `RESEND_API_KEY` y `RESEND_FROM` y probar un envío real.
3. **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`; probar checkout, portal y webhook.
4. **Tenor**: `TENOR_API_KEY` para buscar GIFs (sin ella solo se pegan enlaces).
5. **TURN** para la voz en producción (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`), con coturn o un servicio gestionado; sin TURN algunos pares no se oirán.
6. **Assets de anime** para integrar de forma sutil sobre el estilo limpio (existe un capibara chibi solo en un mockup).

Trabajo técnico sin bloquear:

7. Probar el **chat de voz** entre dos personas reales (se verificó señalización y controles, no audio de extremo a extremo).
8. QA en móvil de los modales de intercambio y de propiedad (verificados en escritorio).
9. El secreto del jugador viaja en la query del WebSocket (`?secret=`); mover a un mensaje de autenticación tras conectar.
10. Persistir los relojes de desconexión en el servidor: hoy viven en memoria y se pierden al reiniciar la API (la inactividad sí está en el estado).
11. Despliegue: no hay Dockerfile ni configuración de producción (proxy con TLS, `NODE_ENV=production`, `CORS_ORIGINS`, base de datos fuera de `prisma/dev.db`).
12. Pulido de layout shift restante: revisar hojas y menús en tablet, y el titular de eventos cuando el texto es largo.
13. Recrear los scripts de humo (crear sala, unir, jugar turnos por REST, chat y presencia por WS) dentro del repo.

## 8. Variables de entorno

Ver `capi-api/.env.example`: `PORT`, `DATABASE_URL`, `TICK_MS`, `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_PEPPER`, `STRIPE_*`, `APP_URL`, `CORS_ORIGINS`, `DISCONNECT_FORFEIT_MS`, `DISCONNECT_GRACE_MS`, `ABANDON_MS`, `TENOR_API_KEY`, `STUN_URLS`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`. El frontend acepta `VITE_API_URL`.
