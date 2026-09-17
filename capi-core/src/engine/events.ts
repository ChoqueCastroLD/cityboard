export type GameOverReason = 'last-standing' | 'time' | 'abandoned';

export type GameEvent = { at: number } & (
  | { type: 'PLAYER_JOINED'; playerId: string }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_REMOVED'; playerId: string; byId: string }
  | { type: 'PLAYER_SPAWNED'; playerId: string }
  | { type: 'PLAYER_UPDATED'; playerId: string }
  | { type: 'HOST_CHANGED'; playerId: string }
  | { type: 'RULES_CHANGED'; keys: string[] }
  | { type: 'MODE_CHANGED'; mode: 'classic' | 'async' }
  | { type: 'BOARD_CHANGED'; boardId: string }
  | { type: 'GAME_STARTED' }
  | { type: 'TURN_STARTED'; playerId: string }
  | { type: 'ROLLED'; playerId: string; dice: [number, number] }
  | { type: 'MOVED'; playerId: string; from: number; to: number; passedStart: boolean }
  | { type: 'PASSED_START'; playerId: string; amount: number }
  | { type: 'LANDED'; playerId: string; tileId: string }
  | { type: 'PAID'; fromId: string; toId: string | null; amount: number; reason: string }
  | { type: 'RECEIVED'; playerId: string; amount: number; reason: string }
  | { type: 'PURCHASE_OFFERED'; playerId: string; tileId: string }
  | { type: 'BOUGHT'; playerId: string; tileId: string; price: number; fromId: string | null }
  | { type: 'DECLINED'; playerId: string; tileId: string }
  | { type: 'CARD_DRAWN'; playerId: string; deckId: string; cardId: string; text: string }
  | { type: 'JAILED'; playerId: string; reason: string }
  | { type: 'RELEASED'; playerId: string; how: 'doubles' | 'fine' | 'card' }
  | { type: 'BUILT'; playerId: string; tileId: string; buildings: number }
  | { type: 'BUILDING_SOLD'; playerId: string; tileId: string; buildings: number }
  | { type: 'MORTGAGED'; playerId: string; tileId: string; amount: number }
  | { type: 'UNMORTGAGED'; playerId: string; tileId: string; amount: number }
  | { type: 'AUCTION_STARTED'; auctionId: string; tileId: string; sellerId: string | null; minBid: number }
  | { type: 'BID_PLACED'; auctionId: string; playerId: string; amount: number }
  | { type: 'AUCTION_PASSED'; auctionId: string; playerId: string }
  | { type: 'AUCTION_ENDED'; auctionId: string; tileId: string; winnerId: string | null; amount: number }
  | { type: 'LOAN_TAKEN'; playerId: string; amount: number; total: number }
  | { type: 'LOAN_REPAID'; playerId: string; amount: number; remaining: number }
  | { type: 'TRADE_PROPOSED'; tradeId: string; fromId: string; toId: string }
  | { type: 'TRADE_ACCEPTED'; tradeId: string }
  | { type: 'TRADE_DECLINED'; tradeId: string }
  | { type: 'TRADE_CANCELLED'; tradeId: string }
  | { type: 'IN_DEBT'; playerId: string; amount: number; creditorId: string | null }
  | { type: 'BANKRUPT'; playerId: string; creditorId: string | null }
  | { type: 'COOLDOWN_STARTED'; playerId: string; until: number }
  | { type: 'AUTO_PLAYED'; playerId: string; action: 'roll' | 'buy' | 'decline' | 'end-turn' | 'bankrupt' | 'jail-card' }
  | { type: 'PLAY_FORCED'; playerId: string; byId: string }
  | { type: 'GAME_OVER'; winnerId: string | null; reason: GameOverReason; standings: Array<{ playerId: string; cash: number }> }
  | { type: 'FORFEITED'; playerId: string; reason: 'afk' | 'disconnected' | 'debt' }
);

export type GameEventType = GameEvent['type'];
