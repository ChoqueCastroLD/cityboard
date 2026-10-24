# Partida de prueba

Crea una partida en curso con tres jugadores (Ana, Beto, Caro), sin inactividad automática, y devuelve el jugador activo con su secreto.

```bash
cd /root/cityboard
docker cp capi-api/scripts/crear-partida.ts capi-api:/app/capi-api/scripts/crear-partida.ts
docker exec capi-api sh -c 'cd /app/capi-api && bun run scripts/crear-partida.ts'
```

Salida (JSON):

```json
{ "id": "NEAXJY", "phase": "playing", "active": { "name": "Ana", "playerId": "p-...", "secret": "..." }, "players": [ ... ] }
```

Variables opcionales: `BOARD=capi-city` para otro tablero, `API_URL=...` para otra API.

## Usarla en un navegador

En el navegador (o en una prueba headless), antes de cargar la página:

```js
localStorage.setItem('capi:session', JSON.stringify({ gameId: ID, playerId: PLAYER_ID, secret: SECRET }));
```

Luego abrir `https://capichan.com/monopoly/room/ID`. Sin esa sesión se ve la pantalla de "unirse como espectador".

## Notas

- El orden de turnos no es el de llegada: usa el `active` que devuelve el script para tirar dados.
- Las partidas sin nadie conectado se cierran a los 30 min. Crea una nueva por prueba.
