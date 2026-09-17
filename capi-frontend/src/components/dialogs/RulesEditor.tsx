import type { GameMode, GameRules } from 'capi-core';
import { Lock } from 'lucide-react';
import { Switch } from '../ui/Switch';

type RuleKey = keyof GameRules;

interface RuleOption {
  label: string;
  value: number;
}

interface RuleMeta {
  key: RuleKey;
  label: string;
  hint?: string;
  seconds?: boolean;
  step?: number;
  options?: RuleOption[];
  showWhen?: (rules: GameRules, mode: GameMode) => boolean;
}

const seconds = (values: number[]): RuleOption[] => values.map((s) => ({ label: `${s} s`, value: s * 1000 }));
const range = (from: number, to: number): RuleOption[] => Array.from({ length: to - from + 1 }, (_, i) => ({ label: String(from + i), value: from + i }));
const minutes = (value: number) => value * 60_000;

const RULES: RuleMeta[] = [
  { key: 'isPublic', label: 'Partida pública', hint: 'Aparece en la lista de partidas públicas para que cualquiera se una.' },
  {
    key: 'competitive',
    label: 'Competitivo',
    hint: 'De 4 a 6 jugadores con cuenta, reglas oficiales fijas, 2 h, sin entradas a media partida; el dinero final cuenta para el ranking.',
  },
  {
    key: 'afkTimeoutMs',
    label: 'Tiempo por inactividad',
    hint: 'Si un jugador no responde, el sistema tira, decide la compra y termina el turno por él.',
    options: [{ label: 'Desactivado', value: 0 }, ...seconds([30, 60, 90, 120])],
  },
  { key: 'maxPlayers', label: 'Jugadores máximos', options: range(2, 8) },
  {
    key: 'maxDurationMs',
    label: 'Duración máxima',
    hint: 'Al acabarse el tiempo gana quien tenga más dinero. Máximo 4 horas.',
    options: [
      { label: '30 min', value: minutes(30) },
      { label: '1 h', value: minutes(60) },
      { label: '2 h', value: minutes(120) },
      { label: '3 h', value: minutes(180) },
      { label: '4 h', value: minutes(240) },
    ],
  },
  { key: 'mortgageEnabled', label: 'Hipoteca', hint: 'Consigue dinero rápido; la propiedad no cobra renta hasta que pagues.' },
  { key: 'mortgageInterest', label: 'Interés de hipoteca', step: 0.05, showWhen: (r) => r.mortgageEnabled },
  { key: 'doubleRentOnMonopoly', label: 'Renta doble', hint: 'Con el grupo completo la renta base se duplica (también estaciones y servicios).' },
  { key: 'noRentInJail', label: 'Sin renta en la cárcel', hint: 'No cobras rentas mientras estás detenido.' },
  { key: 'auctionOnly', label: 'Solo subastas', hint: 'Toda propiedad libre se compra únicamente en subasta.' },
  { key: 'auctionOnDecline', label: 'Subasta al rechazar', hint: 'Si nadie compra, se subasta entre todos.', showWhen: (r) => !r.auctionOnly },
  { key: 'playerAuctions', label: 'Subastar tus propiedades', hint: 'Pon tus propiedades a subasta con puja mínima.' },
  {
    key: 'auctionDurationMs',
    label: 'Duración de subasta (s)',
    hint: '0 = sin límite.',
    seconds: true,
    showWhen: (r) => r.auctionOnly || r.auctionOnDecline || r.playerAuctions,
  },
  { key: 'buyOwnedProperties', label: 'Comprar propiedades ajenas', hint: 'Compra sin permiso, pero mucho más caro.' },
  { key: 'ownedPurchaseMultiplier', label: 'Multiplicador de compra ajena', step: 0.5, showWhen: (r) => r.buyOwnedProperties },
  { key: 'loansEnabled', label: 'Préstamos del banco', hint: 'Pide dinero; pagas intereses cada vuelta.' },
  { key: 'maxLoan', label: 'Préstamo máximo', showWhen: (r) => r.loansEnabled },
  { key: 'loanInterest', label: 'Interés del préstamo', step: 0.05, showWhen: (r) => r.loansEnabled },
  { key: 'tradingEnabled', label: 'Intercambios', hint: 'Negocia propiedades y dinero con otros jugadores.' },
  { key: 'evenBuild', label: 'Construir parejo', hint: 'Las casas se reparten uniformemente en el grupo.' },
  { key: 'hotelUpgrades', label: 'Mejora de hoteles', hint: 'Con hotel en todas tus propiedades puedes añadir hasta 4 pisos por hotel; cada piso sube la renta un 35 %.' },
  { key: 'startingCash', label: 'Dinero inicial' },
  { key: 'passStartBonus', label: 'Bono por pasar la salida' },
  { key: 'landStartBonus', label: 'Bono por caer en la salida (total)' },
  { key: 'jailFine', label: 'Fianza' },
  { key: 'maxJailTurns', label: 'Turnos máximos en la cárcel' },
  { key: 'asyncCooldownMs', label: 'Reloj de arena (s)', hint: 'Tiempo de espera entre tus movimientos.', seconds: true, showWhen: (_, mode) => mode === 'async' },
];

interface Props {
  rules: GameRules;
  editable: boolean;
  mode?: GameMode;
  onChange: (patch: Partial<GameRules>) => void;
}

function Control({ meta, value, editable, onChange }: { meta: RuleMeta; value: number | boolean; editable: boolean; onChange: (patch: Partial<GameRules>) => void }) {
  if (typeof value === 'boolean') {
    return <Switch checked={value} disabled={!editable} label={meta.label} onChange={(v) => onChange({ [meta.key]: v })} />;
  }
  if (meta.options) {
    const known = meta.options.some((o) => o.value === value);
    return (
      <select className="field w-36" disabled={!editable} value={value} onChange={(e) => onChange({ [meta.key]: Number(e.target.value) })} aria-label={meta.label}>
        {!known && <option value={value}>{meta.seconds ? `${value / 1000} s` : value}</option>}
        {meta.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="field w-24 text-right tabular-nums"
      type="number"
      step={meta.step ?? 1}
      disabled={!editable}
      value={meta.seconds ? value / 1000 : value}
      aria-label={meta.label}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange({ [meta.key]: meta.seconds ? n * 1000 : n });
      }}
    />
  );
}

export function RulesEditor({ rules, editable, mode = 'classic', onChange }: Props) {
  const visible = RULES.filter((meta) => !meta.showWhen || meta.showWhen(rules, mode));
  return (
    <div className="flex flex-col divide-y divide-line">
      {visible.map((meta) => {
        const locked = rules.competitive && meta.key !== 'competitive';
        return (
          <div key={meta.key} className={`flex items-center justify-between gap-4 py-2.5 ${locked ? 'opacity-70' : ''}`}>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {meta.label}
                {locked && <Lock size={11} className="text-warn" aria-hidden />}
              </span>
              {meta.hint && <span className="text-xs text-muted">{meta.hint}</span>}
              {locked && <span className="text-[11px] text-warn">Fijada por el modo competitivo</span>}
            </div>
            <Control meta={meta} value={rules[meta.key]} editable={editable && !locked} onChange={onChange} />
          </div>
        );
      })}
    </div>
  );
}
