import {
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  Paintbrush,
  Ruler,
  Cpu,
  Truck,
  Trees,
  ShieldAlert,
  Car,
  Scissors,
  Laptop,
  Camera,
  Building2,
  Shirt,
  Briefcase,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  Paintbrush,
  Ruler,
  Cpu,
  Truck,
  Trees,
  ShieldAlert,
  Car,
  Scissors,
  Laptop,
  Camera,
  Building2,
  Shirt,
};

export function CategoryIcon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}
