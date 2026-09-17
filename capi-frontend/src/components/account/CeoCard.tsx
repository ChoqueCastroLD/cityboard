import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKEN_CATALOG } from 'capi-core';
import { Bird, Crown, ExternalLink, Flame, Gem, type LucideIcon, Satellite, Sparkles, Trophy } from 'lucide-react';
import { api, ApiError } from '../../client/api';
import { useAccount } from '../../hooks/useAccount';
import { useBillingStatus } from '../../hooks/useQueries';
import { guarded, toast } from '../../lib/toast';
import { Sheet } from '../ui/Sheet';

const PREMIUM_PIECES = TOKEN_CATALOG.filter((t) => t.premium);
const PIECE_ICONS: Record<string, LucideIcon> = { Crown, Flame, Bird, Trophy, Gem, Satellite };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

export function CeoCard({ onLogin, compact }: { onLogin: () => void; compact?: boolean }) {
  const { user, premium, refresh } = useAccount();
  const status = useBillingStatus(!!user);
  const client = useQueryClient();
  const configured = status.data?.configured ?? false;
  const premiumUntil = user?.premiumUntil ?? status.data?.premiumUntil ?? null;

  const redirect = useMutation({
    mutationFn: async (kind: 'checkout' | 'portal') => (kind === 'checkout' ? api.billing.checkout() : api.billing.portal()),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e) => toast(e instanceof ApiError && e.code === 'BILLING_NOT_CONFIGURED' ? 'Pagos aún no configurados.' : e instanceof Error ? e.message : String(e)),
  });

  const activate = () =>
    guarded(
      api.billing.devActivate().then(async () => {
        await refresh();
        await client.invalidateQueries({ queryKey: ['billing-status'] });
        toast('Suscripción CEO activada en modo desarrollo.', 'info');
      }),
    );

  return (
    <section className={`glass flex flex-col gap-3 ${compact ? 'p-4' : 'p-5'}`} aria-labelledby="ceo-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ceo-title" className="flex items-center gap-2 text-base font-semibold">
          <Crown size={18} className="text-amber-300" /> Suscripción CEO
        </h2>
        <span className="pill px-2 py-0.5 text-xs text-muted">6 $/mes</span>
      </div>
      <p className="text-sm text-muted">6 fichas premium exclusivas y distintivo CEO en la mesa y en el ranking.</p>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {PREMIUM_PIECES.map((piece) => {
          const PieceIcon = PIECE_ICONS[piece.icon ?? ''] ?? Crown;
          return (
            <li key={piece.id} className="flex flex-col items-center gap-1 rounded-lg bg-white/5 px-1 py-2 text-[11px]" title={piece.label}>
              <PieceIcon size={18} className="text-amber-200" />
              <span className="truncate">{piece.label}</span>
            </li>
          );
        })}
      </ul>
      {!user ? (
        <button className="btn btn-primary h-10" onClick={onLogin}>
          <Sparkles size={15} /> Entra para hacerte CEO
        </button>
      ) : premium ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Eres CEO{premiumUntil ? ` hasta el ${formatDate(premiumUntil)}` : ''}.
          </p>
          {configured && (
            <button className="btn h-10" disabled={redirect.isPending} onClick={() => redirect.mutate('portal')}>
              <ExternalLink size={14} /> Gestionar suscripción
            </button>
          )}
        </div>
      ) : configured ? (
        <button className="btn btn-primary h-10" disabled={redirect.isPending} onClick={() => redirect.mutate('checkout')}>
          <Crown size={15} /> Hazte CEO
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">Pagos aún no configurados.</p>
          {import.meta.env.DEV && (
            <button className="btn h-10" onClick={() => void activate()}>
              Activar en modo desarrollo
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function CeoSheet({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin: () => void }) {
  return (
    <Sheet open={open} title="Fichas CEO" onClose={onClose}>
      <p className="text-sm text-muted">Esa ficha es exclusiva de la suscripción CEO.</p>
      <CeoCard compact onLogin={onLogin} />
    </Sheet>
  );
}
