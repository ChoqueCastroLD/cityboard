import type { AuctionView } from 'capi-core';
import { Timer } from 'lucide-react';
import { useState } from 'react';
import { formatMs, money, playerName, tileName } from '../../lib/format';
import { useGame } from '../game/context';
import { Sheet } from '../ui/Sheet';

function AuctionRow({ view }: { view: AuctionView }) {
  const { board, state, dispatch } = useGame();
  const auction = state.auctions.find((a) => a.id === view.auctionId);
  const [amount, setAmount] = useState(view.minNextBid);
  if (!auction) return null;
  const bid = Math.max(amount, view.minNextBid);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <strong>{tileName(board, auction.tileId)}</strong>
        {view.remainingMs !== null && (
          <span className="pill flex items-center gap-1 px-2 py-0.5 text-xs tabular-nums">
            <Timer size={12} /> {formatMs(view.remainingMs)}
          </span>
        )}
      </div>
      <span className="text-xs text-muted">
        {auction.sellerId ? `Vende ${playerName(state, auction.sellerId)}. ` : ''}
        {auction.highestBidderId
          ? `Mejor puja: ${money(board, auction.highestBid)} de ${playerName(state, auction.highestBidderId)}.`
          : `Sin pujas. Mínimo ${money(board, auction.minBid)}.`}
        {auction.passed.length > 0 && ` Pasaron: ${auction.passed.map((id) => playerName(state, id)).join(', ')}.`}
      </span>
      {(view.canBid || view.canPass) && (
        <div className="flex items-center gap-2">
          <input className="field w-28" type="number" min={view.minNextBid} value={bid} disabled={!view.canBid} onChange={(e) => setAmount(Number(e.target.value))} />
          <button className="btn btn-primary h-9" disabled={!view.canBid} onClick={() => dispatch({ type: 'BID', auctionId: auction.id, amount: bid })}>
            Pujar
          </button>
          <button className="btn h-9" disabled={!view.canPass} onClick={() => dispatch({ type: 'PASS_AUCTION', auctionId: auction.id })}>
            Pasar
          </button>
        </div>
      )}
    </div>
  );
}

export function AuctionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions, state } = useGame();
  return (
    <Sheet open={open} title="Subastas" onClose={onClose}>
      {state.auctions.length === 0 && <p className="text-sm text-muted">No hay subastas abiertas.</p>}
      {actions?.auctions.map((view) => (
        <AuctionRow key={view.auctionId} view={view} />
      ))}
    </Sheet>
  );
}
