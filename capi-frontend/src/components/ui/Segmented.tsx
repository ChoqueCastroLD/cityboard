import type { LucideIcon } from 'lucide-react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  Icon?: LucideIcon;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, size = 'sm', className = '' }: Props<T>) {
  const height = size === 'md' ? 'h-9 px-4 text-sm' : 'h-8 px-3 text-xs';
  return (
    <div className={`no-scrollbar flex max-w-full shrink-0 overflow-x-auto rounded-full bg-fill p-0.5 ${className}`} role="group" aria-label={label}>
      {options.map(({ id, label: text, Icon }) => (
        <button
          key={id}
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full whitespace-nowrap transition ${height} ${value === id ? 'bg-seg-on font-semibold text-ink shadow-sm' : 'font-medium text-muted hover:text-ink'}`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon size={size === 'md' ? 14 : 12} />} {text}
        </button>
      ))}
    </div>
  );
}
