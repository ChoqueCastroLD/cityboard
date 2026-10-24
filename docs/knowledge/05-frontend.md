# Frontend (capi-frontend)

## Estructura

- `src/screens`: Home, Room (lobby y partida).
- `src/components/game`: HUD, chips, dock, registro, `Board3D`, `Board2D`, `board2d/`.
- `src/components/dialogs`: casilla, intercambio, préstamo, subastas, ajustes.
- `src/three`: escena 3D imperativa (renderer, cámara, fichas, dados).
- `src/client`: REST (`api.ts`) y WebSocket (`RemoteGameClient.ts`).

## Contrato de tablero

`GameScreen` habla con el tablero a través de `IBoardScene` (`src/three/types.ts`). Board3D y Board2D lo implementan; lo importante es `projectPlayer` (ancla la carta revelada a la ficha), `catchUp` (salta al estado final tras volver de segundo plano), `focusPlayer` y `focusTile`.

La vista se elige con `useBoardView` (`src/lib/boardView.ts`, clave `capi:board-view`, por defecto `2d`) y se cambia desde el HUD.

## Ruta base /monopoly

- `vite.config.ts` tiene `base: '/monopoly/'` y el router `basepath: import.meta.env.BASE_URL`.
- `VITE_API_URL=/monopoly` en el build de producción: la API y el WS cuelgan de esa ruta.
- Los JSON de tablero traen rutas absolutas `/boards/...`. `request()` en `api.ts` las reescribe con `rebase()` al recibirlas. Cualquier dato nuevo con rutas de imagen debe pasar por ahí.
- Enlaces construidos a mano deben usar `import.meta.env.BASE_URL` (ej. el enlace de invitación del lobby).

## PWA

- Manifest y service worker con alcance `/monopoly/`. El SW cachea assets y tableros (cache-first) y deja pasar `/api` y `/ws`.
- Al cargar, el cliente desregistra cualquier SW viejo con alcance en la raíz (de cuando el juego vivía en `/`).
- Si cambian los assets cacheados, sube el nombre de cache en `public/sw.js`.

## Estilo

- Tema claro/oscuro con `.theme-clean`; la partida usa glass oscuro.
- En pantallas de menos de 768 px los diálogos y menús son opacos: con glass translúcido el dock se transparentaba y la última fila era ilegible.
- Fuentes: Fredoka (marca, títulos) y Nunito (cuerpo), empaquetadas con fontsource.

## Detalles que muerden

- Los hooks `useTouch()` y `usePhone()` deben llamarse siempre; `useTouch() || usePhone()` cambiaba el número de hooks entre renders.
- Los tooltips de casilla y ficha usan una sola instancia con `key` fija; con `key` por casilla y hover en cada `mousemove` se acumulaban fantasmas.
- En táctil (`hover: none`) los tooltips se ocultan a propósito.
