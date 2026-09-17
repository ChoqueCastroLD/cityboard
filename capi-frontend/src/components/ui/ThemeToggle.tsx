import { Moon, MonitorSmartphone, Sun } from 'lucide-react';
import { setThemePreference, type ThemePreference, useThemePreference } from '../../hooks/useCleanTheme';

const ORDER: ThemePreference[] = ['auto', 'light', 'dark'];
const LABEL: Record<ThemePreference, string> = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema oscuro' };
const ICON = { auto: MonitorSmartphone, light: Sun, dark: Moon };

export function ThemeToggle() {
  const preference = useThemePreference();
  const Icon = ICON[preference];
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!;
  return (
    <button type="button" className="btn btn-icon h-10 w-10" onClick={() => setThemePreference(next)} aria-label={`${LABEL[preference]}. Cambiar a ${LABEL[next].toLowerCase()}`} title={LABEL[preference]}>
      <Icon size={17} />
    </button>
  );
}
