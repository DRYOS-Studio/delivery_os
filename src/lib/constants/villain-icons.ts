import {
  AlertTriangle,
  BatteryLow,
  Brain,
  Bug,
  ClipboardList,
  Database,
  Droplet,
  EyeOff,
  Flame,
  Frown,
  Ghost,
  HelpCircle,
  Hourglass,
  Lock,
  RotateCcw,
  ShieldOff,
  Skull,
  TrendingDown,
  Volume2,
  Zap,
} from "lucide-react";

export const VILLAIN_ICONS = {
  ClipboardList,
  Database,
  RotateCcw,
  Hourglass,
  HelpCircle,
  Droplet,
  EyeOff,
  AlertTriangle,
  Skull,
  Flame,
  Bug,
  Zap,
  Brain,
  Volume2,
  Ghost,
  Frown,
  TrendingDown,
  Lock,
  BatteryLow,
  ShieldOff,
} as const;

export type VillainIconName = keyof typeof VILLAIN_ICONS;

export const VILLAIN_ICON_NAMES = Object.keys(
  VILLAIN_ICONS,
) as VillainIconName[];

export function resolveVillainIcon(name: string) {
  return (VILLAIN_ICONS as Record<string, typeof HelpCircle>)[name] ??
    HelpCircle;
}
