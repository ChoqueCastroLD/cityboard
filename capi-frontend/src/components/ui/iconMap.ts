import { icons } from 'lucide-react';

export type IconComponent = (typeof icons)[keyof typeof icons];

export const iconMap = icons as Record<string, IconComponent | undefined>;
