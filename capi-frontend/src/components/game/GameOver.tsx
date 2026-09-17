import { Timer, Trophy, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useAccount } from '../../hooks/useAccount';
import { money, playerName } from '../../lib/format';
import { useGame } from './context';

export function GameOver() {
  const { state, board, log, leave, client } = useGame();
  const { user } = useAccount();
  const over = [...log].reverse().find((entry) => entry.event.type === 'GAME_OVER')?.event;
  const standings =
    over && over.type === 'GAME_OVER'
      ? over.standings
      : state.players
          .filter((p) => !p.spectator)
          .map((p) => ({ playerId: p.id, cash: p.bankrupt ? (p.finalCash ?? 0) : p.cash, bankrupt: p.bankrupt }))
          .sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.cash - a.cash);
  const bankrupt = new Set(state.players.filter((p) => p.bankrupt).map((p) => p.id));
  const reason = over?.type === 'GAME_OVER' ? over.reason : 'last-standing';
  const reasonLabel = reason === 'time' ? 'Fin por tiempo' : reason === 'abandoned' ? 'Partida abandonada' : 'Último en pie';
  const played = !!client.myPlayerId && standings.some((s) => s.playerId === client.myPlayerId);

  return (
    <motion.div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.section className="glass flex w-full max-w-md flex-col items-center gap-4 px-6 py-7 text-center sm:px-8" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
        <Trophy size={40} className="text-amber-300" />
        <h2 className="text-2xl font-bold">{state.winnerId ? `¡${playerName(state, state.winnerId)} gana!` : 'Partida terminada'}</h2>
        <span className="pill inline-flex items-center gap-1.5 px-3 py-1 text-xs text-muted">
          {reason === 'time' ? <Timer size={12} /> : <Users size={12} />}
          {reasonLabel}
        </span>
        {standings.length > 0 && (
          <table className="w-full text-sm">
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.playerId} className={`${s.playerId === client.myPlayerId ? 'font-semibold' : ''} ${bankrupt.has(s.playerId) ? 'text-muted line-through' : ''}`}>
                  <td className="w-8 py-1 text-left text-muted tabular-nums">{i + 1}.</td>
                  <td className="py-1 text-left">{playerName(state, s.playerId)}</td>
                  <td className="py-1 text-right tabular-nums">{money(board, bankrupt.has(s.playerId) ? (state.players.find((p) => p.id === s.playerId)?.finalCash ?? s.cash) : s.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {state.rules.competitive && played && user && <p className="text-xs text-accent">Tu dinero final se sumó a tu ranking.</p>}
        <button className="btn btn-primary h-11 w-full" onClick={leave}>
          Volver al inicio
        </button>
      </motion.section>
    </motion.div>
  );
}
