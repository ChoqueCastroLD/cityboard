import { useState } from 'react';
import { money } from '../../lib/format';
import { useGame } from '../game/context';
import { Sheet } from '../ui/Sheet';

export function LoanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { board, state, me, actions, dispatch } = useGame();
  const { rules } = state;
  const loan = me?.loan ?? 0;
  const room = Math.max(0, rules.maxLoan - loan);
  const repayMax = Math.max(0, Math.min(loan, me?.cash ?? 0));
  const [borrow, setBorrow] = useState(100);
  const [repay, setRepay] = useState(0);

  return (
    <Sheet open={open} title="Préstamo del banco" onClose={onClose}>
      <p className="text-sm text-muted">
        Deuda actual <strong className="text-ink">{money(board, loan)}</strong> de {money(board, rules.maxLoan)}. Interés del {Math.round(rules.loanInterest * 100)}% cada vez que pasas por la salida.
      </p>
      {actions?.canBorrow && (
        <div className="flex items-center gap-2">
          <input className="field" type="number" min={1} max={room} value={borrow} onChange={(e) => setBorrow(Number(e.target.value))} />
          <button className="btn btn-primary" disabled={borrow <= 0 || borrow > room} onClick={() => dispatch({ type: 'BORROW', amount: Math.floor(borrow) }).then(onClose)}>
            Pedir
          </button>
        </div>
      )}
      {actions?.canRepay && (
        <div className="flex items-center gap-2">
          <input className="field" type="number" min={1} max={repayMax} value={repay || repayMax} onChange={(e) => setRepay(Number(e.target.value))} />
          <button className="btn" disabled={(repay || repayMax) <= 0 || (repay || repayMax) > repayMax} onClick={() => dispatch({ type: 'REPAY', amount: Math.floor(repay || repayMax) }).then(onClose)}>
            Devolver
          </button>
        </div>
      )}
    </Sheet>
  );
}
