export type GameErrorCode =
  | 'NOT_FOUND'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'NOT_ALLOWED'
  | 'RULE_DISABLED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_COMMAND';

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export function assert(condition: unknown, code: GameErrorCode, message: string): asserts condition {
  if (!condition) throw new GameError(code, message);
}
