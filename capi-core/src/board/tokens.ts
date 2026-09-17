import type { BoardDefinition, TokenOption } from './schema';

export const TOKEN_CATALOG: TokenOption[] = [
  { id: 'capibara', label: 'Capibara', icon: 'Squirrel', shape: 'capibara' },
  { id: 'tucan', label: 'Tucán', icon: 'Bird', shape: 'tucan' },
  { id: 'cactus', label: 'Cactus', icon: 'Leaf', shape: 'cactus' },
  { id: 'volcan', label: 'Volcán', icon: 'Flame', shape: 'volcan' },
  { id: 'barco', label: 'Barco', icon: 'Sailboat', shape: 'barco' },
  { id: 'guitarra', label: 'Guitarra', icon: 'Guitar', shape: 'guitarra' },
  { id: 'mate', label: 'Mate', icon: 'Coffee', shape: 'mate' },
  { id: 'cometa', label: 'Cometa', icon: 'Star', shape: 'cometa' },
  { id: 'tortuga', label: 'Tortuga', icon: 'Turtle', shape: 'tortuga' },
  { id: 'pulpo', label: 'Pulpo', icon: 'Origami', shape: 'pulpo' },
  { id: 'cohete', label: 'Cohete', icon: 'Rocket', shape: 'cohete' },
  { id: 'sombrero', label: 'Sombrero', icon: 'Crown', shape: 'sombrero' },
  { id: 'pinguino', label: 'Pingüino', icon: 'Snowflake', shape: 'pinguino' },
  { id: 'caballo', label: 'Caballo', icon: 'Wind', shape: 'caballo' },
  { id: 'cybertruck', label: 'Cybertruck', icon: 'Truck', shape: 'cybertruck' },
  { id: 'stickman', label: 'Stickman', icon: 'PersonStanding', shape: 'stickman' },
  { id: 'torres', label: 'Torres gemelas', icon: 'Building2', shape: 'torres' },
  { id: 'paloma', label: 'Paloma', icon: 'Bird', shape: 'paloma' },
  { id: 'moto', label: 'Moto', icon: 'Bike', shape: 'moto' },
  { id: 'formula1', label: 'Fórmula 1', icon: 'Car', shape: 'formula1' },
  { id: 'rata', label: 'Rata', icon: 'Rat', shape: 'rata' },
  { id: 'cubo', label: 'Cubo', icon: 'Box', shape: 'cubo' },
  { id: 'piramide', label: 'Pirámide', icon: 'Pyramid', shape: 'piramide' },
  { id: 'corona', label: 'Corona CEO', icon: 'Crown', shape: 'corona', premium: true },
  { id: 'dragon', label: 'Dragón', icon: 'Flame', shape: 'dragon', premium: true },
  { id: 'fenix', label: 'Fénix', icon: 'Bird', shape: 'fenix', premium: true },
  { id: 'trofeo', label: 'Trofeo', icon: 'Trophy', shape: 'trofeo', premium: true },
  { id: 'diamante', label: 'Diamante', icon: 'Gem', shape: 'diamante', premium: true },
  { id: 'satelite', label: 'Satélite', icon: 'Satellite', shape: 'satelite', premium: true },
];

export function boardTokens(board: Pick<BoardDefinition, 'tokens'>): TokenOption[] {
  return board.tokens && board.tokens.length > 0 ? board.tokens : TOKEN_CATALOG;
}

export function isPremiumToken(board: Pick<BoardDefinition, 'tokens'>, tokenId: string): boolean {
  return boardTokens(board).find((t) => t.id === tokenId)?.premium === true;
}
