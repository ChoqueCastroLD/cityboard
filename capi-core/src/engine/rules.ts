export type GameMode = 'classic' | 'async';

export interface GameRules {
  isPublic: boolean;
  competitive: boolean;
  afkTimeoutMs: number;
  maxPlayers: number;
  maxDurationMs: number;
  startingCash: number;
  passStartBonus: number;

  landStartBonus: number;
  jailFine: number;

  maxJailTurns: number;

  maxDoubles: number;

  maxBuildings: number;

  evenBuild: boolean;

  hotelUpgrades: boolean;

  buildingSellRatio: number;

  mortgageEnabled: boolean;

  mortgageInterest: number;

  doubleRentOnMonopoly: boolean;

  noRentInJail: boolean;

  auctionOnly: boolean;

  auctionOnDecline: boolean;

  playerAuctions: boolean;

  auctionDurationMs: number;

  buyOwnedProperties: boolean;

  ownedPurchaseMultiplier: number;

  loansEnabled: boolean;
  maxLoan: number;
  loanInterest: number;

  tradingEnabled: boolean;

  asyncCooldownMs: number;
}

export const HOTEL_FLOORS = 4;
export const HOTEL_FLOOR_RENT_BONUS = 0.35;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
export const COMPETITIVE_DURATION_MS = 2 * 60 * 60 * 1000;
export const COMPETITIVE_AFK_MS = 120_000;

export const COMPETITIVE_MIN_PLAYERS = 4;
export const COMPETITIVE_MAX_PLAYERS = 6;

export const COMPETITIVE_RULES: Partial<GameRules> = {
  afkTimeoutMs: COMPETITIVE_AFK_MS,
  maxDurationMs: COMPETITIVE_DURATION_MS,
  maxPlayers: COMPETITIVE_MAX_PLAYERS,
  mortgageEnabled: true,
  doubleRentOnMonopoly: true,
  noRentInJail: false,
  auctionOnly: false,
  auctionOnDecline: true,
  playerAuctions: false,
  buyOwnedProperties: false,
  loansEnabled: false,
  tradingEnabled: true,
  evenBuild: true,
  hotelUpgrades: false,
};

export const DEFAULT_RULES: GameRules = {
  isPublic: false,
  competitive: false,
  afkTimeoutMs: 120_000,
  maxPlayers: MAX_PLAYERS,
  maxDurationMs: MAX_DURATION_MS,
  startingCash: 1500,
  passStartBonus: 200,
  landStartBonus: 400,
  jailFine: 50,
  maxJailTurns: 3,
  maxDoubles: 3,
  maxBuildings: 5,
  evenBuild: true,
  hotelUpgrades: false,
  buildingSellRatio: 0.5,

  mortgageEnabled: true,
  mortgageInterest: 0.1,
  doubleRentOnMonopoly: true,
  noRentInJail: false,
  auctionOnly: false,
  auctionOnDecline: true,
  playerAuctions: true,
  auctionDurationMs: 30_000,
  buyOwnedProperties: false,
  ownedPurchaseMultiplier: 2,
  loansEnabled: false,
  maxLoan: 500,
  loanInterest: 0.1,
  tradingEnabled: true,

  asyncCooldownMs: 20_000,
};

export interface RulePreset {
  id: 'rapida' | 'clasica' | 'moderna' | 'larga';
  name: string;
  description: string;
  rules: Partial<GameRules>;
}

const CLASSIC_PRESET: Partial<GameRules> = {
  startingCash: 1500,
  passStartBonus: 200,
  landStartBonus: 200,
  jailFine: 50,
  maxJailTurns: 3,
  maxDoubles: 3,
  evenBuild: true,
  hotelUpgrades: false,
  mortgageEnabled: true,
  mortgageInterest: 0.1,
  doubleRentOnMonopoly: true,
  noRentInJail: true,
  auctionOnly: false,
  auctionOnDecline: true,
  playerAuctions: false,
  auctionDurationMs: 30_000,
  buyOwnedProperties: false,
  loansEnabled: false,
  tradingEnabled: true,
  afkTimeoutMs: 120_000,
  maxDurationMs: MAX_DURATION_MS,
  asyncCooldownMs: 20_000,
};

export const RULE_PRESETS: RulePreset[] = [
  {
    id: 'rapida',
    name: 'Partida rápida',
    description: 'Menos dinero, subastas y turnos cortos para terminar en menos de una hora.',
    rules: {
      ...CLASSIC_PRESET,
      hotelUpgrades: true,
      startingCash: 1000,
      landStartBonus: 400,
      maxJailTurns: 2,
      noRentInJail: false,
      auctionDurationMs: 15_000,
      buyOwnedProperties: true,
      ownedPurchaseMultiplier: 1.5,
      afkTimeoutMs: 30_000,
      maxDurationMs: 60 * 60 * 1000,
      asyncCooldownMs: 10_000,
    },
  },
  {
    id: 'clasica',
    name: 'Partida clásica',
    description: 'Las reglas de toda la vida: sin préstamos, subasta si nadie compra y sin renta en la cárcel.',
    rules: CLASSIC_PRESET,
  },
  {
    id: 'moderna',
    name: 'Partida moderna',
    description: 'Como la clásica, con préstamos grandes al 25 %, subasta de tus propiedades, sin subasta al rechazar, sin renta en la cárcel y bono de 500 al caer en la salida.',
    rules: {
      ...CLASSIC_PRESET,
      hotelUpgrades: true,
      loansEnabled: true,
      maxLoan: 2000,
      loanInterest: 0.25,
      auctionOnDecline: false,
      playerAuctions: true,
      noRentInJail: true,
      landStartBonus: 500,
    },
  },
  {
    id: 'larga',
    name: 'Partida larga',
    description: 'Más dinero inicial, préstamos grandes, compras entre jugadores y subastas propias para partidas de fondo.',
    rules: {
      ...CLASSIC_PRESET,
      startingCash: 3000,
      passStartBonus: 400,
      landStartBonus: 800,
      noRentInJail: false,
      loansEnabled: true,
      maxLoan: 2000,
      loanInterest: 0.05,
      buyOwnedProperties: true,
      ownedPurchaseMultiplier: 2,
      playerAuctions: true,
    },
  },
];

export function matchesPreset(rules: GameRules, preset: RulePreset): boolean {
  return (Object.keys(preset.rules) as Array<keyof GameRules>).every((key) => rules[key] === preset.rules[key]);
}

export function resolveRules(...layers: Array<Partial<GameRules> | undefined>): GameRules {
  const rules: GameRules = Object.assign({}, DEFAULT_RULES, ...layers.map((l) => l ?? {}));
  const bounded = rules.maxDurationMs > 0 && rules.maxDurationMs <= MAX_DURATION_MS ? rules.maxDurationMs : MAX_DURATION_MS;
  const withDuration = { ...rules, maxDurationMs: bounded };
  return withDuration.competitive ? { ...withDuration, ...COMPETITIVE_RULES, isPublic: true } : withDuration;
}
