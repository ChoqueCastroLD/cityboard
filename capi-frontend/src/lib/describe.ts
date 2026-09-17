import type { BoardDefinition, GameEvent, GameEventType, GameState } from 'capi-core';
import { money, playerName, tileName, translateReason } from './format';

export const HIDDEN_EVENT_TYPES = new Set<GameEventType>(['PLAYER_UPDATED']);

export const isVisibleEvent = (e: GameEvent) => !HIDDEN_EVENT_TYPES.has(e.type);

export function describeEvent(e: GameEvent, board: BoardDefinition, state: GameState): string {
  const p = (id: string | null) => playerName(state, id);
  const t = (id: string) => tileName(board, id);
  const m = (n: number) => money(board, n);
  switch (e.type) {
    case 'PLAYER_JOINED':
      return `${p(e.playerId)} se unió a la mesa.`;
    case 'PLAYER_LEFT':
      return `${p(e.playerId)} abandonó la partida.`;
    case 'PLAYER_REMOVED':
      return `${p(e.byId)} marcó en bancarrota a ${p(e.playerId)} por ausencia.`;
    case 'HOST_CHANGED':
      return `${p(e.playerId)} ahora es el anfitrión.`;
    case 'PLAYER_SPAWNED':
      return `${p(e.playerId)} entra en la partida.`;
    case 'AUTO_PLAYED': {
      const actions = {
        roll: 'tiró los dados',
        buy: 'compró',
        decline: 'rechazó la compra',
        'end-turn': 'terminó el turno',
        bankrupt: 'se declaró en bancarrota',
        'jail-card': 'usó su carta de salida',
      };
      return `${p(e.playerId)} estaba ausente: el sistema ${actions[e.action]} por él.`;
    }
    case 'PLAY_FORCED':
      return `${p(e.byId)} forzó la jugada de ${p(e.playerId)}.`;
    case 'PLAYER_UPDATED':
      return `${p(e.playerId)} cambió su apariencia.`;
    case 'RULES_CHANGED':
      return `Reglas actualizadas: ${e.keys.join(', ')}.`;
    case 'MODE_CHANGED':
      return `El anfitrión cambió el modo a ${e.mode === 'async' ? 'Async' : 'Clásico'}.`;
    case 'BOARD_CHANGED':
      return e.boardId === board.id ? `El anfitrión cambió el tablero a ${board.name}.` : 'El anfitrión cambió el tablero.';
    case 'GAME_STARTED':
      return 'La partida ha comenzado.';
    case 'TURN_STARTED':
      return `Turno de ${p(e.playerId)}.`;
    case 'ROLLED':
      return `${p(e.playerId)} sacó ${e.dice[0]} y ${e.dice[1]}${e.dice[0] === e.dice[1] ? ' (¡dobles!)' : ''}.`;
    case 'MOVED':
      return `${p(e.playerId)} avanza hasta ${t(board.tiles[e.to]?.id ?? '')}.`;
    case 'PASSED_START':
      return `${p(e.playerId)} pasa por la salida y cobra ${m(e.amount)}.`;
    case 'LANDED':
      return `${p(e.playerId)} cae en ${t(e.tileId)}.`;
    case 'PAID':
      return `${p(e.fromId)} paga ${m(e.amount)} a ${p(e.toId)} (${translateReason(e.reason)}).`;
    case 'RECEIVED':
      return `${p(e.playerId)} recibe ${m(e.amount)} (${translateReason(e.reason)}).`;
    case 'PURCHASE_OFFERED':
      return `${t(e.tileId)} está en venta para ${p(e.playerId)}.`;
    case 'BOUGHT':
      return `${p(e.playerId)} compra ${t(e.tileId)} por ${m(e.price)}${e.fromId ? ` a ${p(e.fromId)}` : ''}.`;
    case 'DECLINED':
      return `${p(e.playerId)} no compra ${t(e.tileId)}.`;
    case 'CARD_DRAWN':
      return `${p(e.playerId)} saca una carta: "${e.text}"`;
    case 'JAILED':
      return `${p(e.playerId)} va a la cárcel (${e.reason}).`;
    case 'RELEASED':
      return `${p(e.playerId)} sale de la cárcel (${{ doubles: 'dobles', fine: 'fianza', card: 'carta' }[e.how]}).`;
    case 'BUILT':
      return `${p(e.playerId)} construye en ${t(e.tileId)} (${e.buildings}).`;
    case 'BUILDING_SOLD':
      return `${p(e.playerId)} vende una construcción en ${t(e.tileId)}.`;
    case 'MORTGAGED':
      return `${p(e.playerId)} hipoteca ${t(e.tileId)} por ${m(e.amount)}.`;
    case 'UNMORTGAGED':
      return `${p(e.playerId)} levanta la hipoteca de ${t(e.tileId)} (${m(e.amount)}).`;
    case 'AUCTION_STARTED':
      return `Subasta de ${t(e.tileId)}${e.sellerId ? ` por ${p(e.sellerId)}` : ''}. Puja mínima ${m(e.minBid)}.`;
    case 'BID_PLACED':
      return `${p(e.playerId)} puja ${m(e.amount)}.`;
    case 'AUCTION_PASSED':
      return `${p(e.playerId)} pasa en la subasta.`;
    case 'AUCTION_ENDED':
      return e.winnerId
        ? `${p(e.winnerId)} gana la subasta de ${t(e.tileId)} por ${m(e.amount)}.`
        : `La subasta de ${t(e.tileId)} termina sin comprador.`;
    case 'LOAN_TAKEN':
      return `${p(e.playerId)} pide ${m(e.amount)} al banco (deuda ${m(e.total)}).`;
    case 'LOAN_REPAID':
      return `${p(e.playerId)} devuelve ${m(e.amount)} al banco.`;
    case 'TRADE_PROPOSED':
      return `${p(e.fromId)} propone un intercambio a ${p(e.toId)}.`;
    case 'TRADE_ACCEPTED':
      return 'Intercambio aceptado.';
    case 'TRADE_DECLINED':
      return 'Intercambio rechazado.';
    case 'TRADE_CANCELLED':
      return 'Intercambio cancelado.';
    case 'IN_DEBT':
      return `${p(e.playerId)} debe ${m(e.amount)} a ${p(e.creditorId)}.`;
    case 'BANKRUPT':
      return `${p(e.playerId)} está en bancarrota.`;
    case 'COOLDOWN_STARTED':
      return `El reloj de arena de ${p(e.playerId)} empieza a correr.`;
    case 'GAME_OVER':
      return e.winnerId
        ? `¡${p(e.winnerId)} gana la partida${e.reason === 'time' ? ' por tiempo' : e.reason === 'abandoned' ? ' (partida abandonada)' : ''}!`
        : 'La partida ha terminado.';
    case 'FORFEITED': {
      const reasons = { afk: 'por inactividad', disconnected: 'por desconexión', debt: 'por deudas' };
      return `${p(e.playerId)} queda fuera ${reasons[e.reason]}.`;
    }
  }
}
