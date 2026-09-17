import type { Ctx } from './context';
import { assert } from './errors';

export function borrow(ctx: Ctx, playerId: string, amount: number): void {
  const { rules } = ctx.state;
  assert(rules.loansEnabled, 'RULE_DISABLED', 'loans are disabled');
  assert(Number.isInteger(amount) && amount > 0, 'INVALID_COMMAND', 'invalid amount');
  const player = ctx.player(playerId);
  assert(player.loan + amount <= rules.maxLoan, 'NOT_ALLOWED', `the bank lends at most ${rules.maxLoan}`);
  player.loan += amount;
  player.cash += amount;
  ctx.emit({ type: 'LOAN_TAKEN', playerId, amount, total: player.loan });
}

export function repay(ctx: Ctx, playerId: string, amount: number): void {
  assert(Number.isInteger(amount) && amount > 0, 'INVALID_COMMAND', 'invalid amount');
  const player = ctx.player(playerId);
  assert(amount <= player.loan, 'INVALID_COMMAND', 'amount exceeds the loan');
  assert(amount <= player.cash, 'INSUFFICIENT_FUNDS', 'not enough cash');
  player.loan -= amount;
  player.cash -= amount;
  ctx.emit({ type: 'LOAN_REPAID', playerId, amount, remaining: player.loan });
}
