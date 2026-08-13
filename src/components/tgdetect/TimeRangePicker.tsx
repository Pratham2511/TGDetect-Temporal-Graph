'use client';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | 'custom';

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { label: string; value: TimeRange }[] = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '12H', value: '12h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
];

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <div className="flex items-center gap-1 bg-[hsl(var(--secondary))] rounded-lg p-0.5">
      <Clock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] ml-1.5" />
      {ranges.map((r) => (
        <Button
          key={r.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(r.value)}
          className={`h-6 px-2 text-[10px] font-medium rounded-md transition-all ${
            value === r.value
              ? 'bg-emerald-400/10 text-emerald-400 shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card-hover))]'
          }`}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}
