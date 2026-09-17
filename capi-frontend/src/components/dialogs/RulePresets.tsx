import { type GameRules, matchesPreset, RULE_PRESETS, type RulePreset } from 'capi-core';
import { Check, Gauge, Landmark, Scroll, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

const ICONS: Record<RulePreset['id'], ReactNode> = {
  rapida: <Timer size={13} />,
  clasica: <Scroll size={13} />,
  moderna: <Landmark size={13} />,
  larga: <Gauge size={13} />,
};

export function RulePresets({ rules, editable, onApply }: { rules: GameRules; editable: boolean; onApply: (patch: Partial<GameRules>) => void }) {
  const disabled = !editable || rules.competitive;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets de reglas">
        {RULE_PRESETS.map((preset) => {
          const active = matchesPreset(rules, preset);
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.description}
              aria-pressed={active}
              onClick={() => onApply(preset.rules)}
              className={`pill inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? 'bg-accent/15 text-accent ring-1 ring-accent' : 'bg-surface hover:bg-fill-2'
              }`}
            >
              {active ? <Check size={13} /> : ICONS[preset.id]}
              {preset.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        {rules.competitive
          ? 'El modo competitivo usa sus propias reglas fijas.'
          : (RULE_PRESETS.find((p) => matchesPreset(rules, p))?.description ?? 'Reglas personalizadas. Elige un preset o ajusta cada opción abajo.')}
      </p>
    </div>
  );
}
