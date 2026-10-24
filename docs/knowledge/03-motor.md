# Motor (capi-core)

- Reductor puro: `apply(board, state, command) → { state, events }`. Estado inmutable por comando (`structuredClone`), RNG con semilla dentro del estado.
- Comandos en `src/engine/commands.ts`. Los más usados en pruebas: `START`, `ROLL`, `BUY`, `DECLINE`, `END_TURN`. Comandos de sistema: `TICK`, `FORFEIT`, `FINISH`.
- Eventos tipados en `src/engine/events.ts`. Los que anima el cliente: `ROLLED`, `MOVED`, `CARD_DRAWN`, `GAME_STARTED`.
- `TICK` cubre todo lo temporal: relojes de arena (async), subastas, inactividad (AFK), abandono y límite de duración.
- Fase de turno por jugador: `idle | roll | act`. El modo solo decide quién sale de `idle`.
- `state.activePlayerId` es el jugador en turno (clásico). El orden de turnos no es el de llegada; para probar hay que leerlo del estado.
- Reglas por defecto en `src/engine/rules.ts`; cada tablero puede sobrescribirlas con `defaultRules`.
- Geometría del anillo en `src/board/layout.ts` (`computeRingLayout`): número par de casillas, mínimo 8. La usan el 3D y el 2D.

Tests: `bun run --cwd capi-core test` (29, vitest).
