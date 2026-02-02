import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ReviewLabelChipProps {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
}

export default function ReviewLabelChip({ label, emoji, selected, onToggle }: ReviewLabelChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
        "border hover:scale-[1.02] active:scale-[0.98]",
        selected
          ? "bg-gold/20 border-gold text-gold shadow-[0_0_12px_rgba(199,167,108,0.3)]"
          : "bg-card/50 border-border/50 text-muted-foreground hover:border-gold/50 hover:text-foreground"
      )}
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span>{label}</span>
      {selected && (
        <Check className="w-4 h-4 text-gold animate-fade-in" />
      )}
    </button>
  );
}
