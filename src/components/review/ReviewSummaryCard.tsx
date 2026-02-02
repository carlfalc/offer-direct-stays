import { cn } from '@/lib/utils';
import { Sparkles, MessageSquare } from 'lucide-react';

interface ReviewSummaryCardProps {
  selectedLabels: string[];
  freeText: string;
  className?: string;
}

export default function ReviewSummaryCard({ selectedLabels, freeText, className }: ReviewSummaryCardProps) {
  const hasContent = selectedLabels.length > 0 || freeText.trim().length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn(
      "p-4 rounded-xl bg-gradient-to-br from-gold/5 to-teal/5 border border-gold/20",
      "animate-fade-in",
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-gold" />
        </div>
        <h4 className="font-display text-sm font-semibold text-foreground">
          Your Review Summary
        </h4>
      </div>

      {selectedLabels.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">Highlights</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedLabels.map((label) => (
              <span
                key={label}
                className="px-2 py-1 text-xs rounded-full bg-gold/15 text-gold border border-gold/30"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {freeText.trim() && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Your thoughts
          </p>
          <p className="text-sm text-foreground/80 italic line-clamp-3">
            "{freeText}"
          </p>
        </div>
      )}
    </div>
  );
}
