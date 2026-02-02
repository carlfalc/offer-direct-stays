import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Star } from 'lucide-react';
import ReviewLabelChip from './ReviewLabelChip';
import ReviewSummaryCard from './ReviewSummaryCard';
import { cn } from '@/lib/utils';

interface ReviewLabel {
  id: string;
  label: string;
  emoji: string;
  category: 'location' | 'amenities' | 'vibe' | 'service';
}

const REVIEW_LABELS: ReviewLabel[] = [
  { id: 'quiet', label: 'Quiet', emoji: '🤫', category: 'vibe' },
  { id: 'great-location', label: 'Great location', emoji: '📍', category: 'location' },
  { id: 'close-to-parks', label: 'Close to parks', emoji: '🌳', category: 'location' },
  { id: 'family-friendly', label: 'Family-friendly', emoji: '👨‍👩‍👧‍👦', category: 'vibe' },
  { id: 'walkable', label: 'Walkable', emoji: '🚶', category: 'location' },
  { id: 'clean', label: 'Clean', emoji: '✨', category: 'amenities' },
  { id: 'great-value', label: 'Great value', emoji: '💎', category: 'vibe' },
  { id: 'friendly-staff', label: 'Friendly staff', emoji: '😊', category: 'service' },
  { id: 'great-wifi', label: 'Great Wi-Fi', emoji: '📶', category: 'amenities' },
  { id: 'cozy', label: 'Cozy', emoji: '🛋️', category: 'vibe' },
  { id: 'luxury-feel', label: 'Luxury feel', emoji: '👑', category: 'vibe' },
  { id: 'near-beach', label: 'Near beach', emoji: '🏖️', category: 'location' },
  { id: 'central', label: 'Central', emoji: '🏙️', category: 'location' },
  { id: 'easy-parking', label: 'Easy parking', emoji: '🅿️', category: 'amenities' },
];

interface PostStayReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyName?: string;
  onSubmit?: (review: ReviewPayload) => void;
}

export interface ReviewPayload {
  selectedLabels: string[];
  labelIds: string[];
  freeText: string;
  propertyName?: string;
  submittedAt: string;
}

export default function PostStayReviewModal({
  open,
  onOpenChange,
  propertyName = 'your stay',
  onSubmit,
}: PostStayReviewModalProps) {
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLabels = useMemo(() => {
    return REVIEW_LABELS
      .filter(l => selectedLabelIds.has(l.id))
      .map(l => l.label);
  }, [selectedLabelIds]);

  const toggleLabel = (id: string) => {
    setSelectedLabelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const payload: ReviewPayload = {
      selectedLabels,
      labelIds: Array.from(selectedLabelIds),
      freeText: freeText.trim(),
      propertyName,
      submittedAt: new Date().toISOString(),
    };

    // Simulate submission delay
    await new Promise(resolve => setTimeout(resolve, 800));

    onSubmit?.(payload);
    setIsSubmitting(false);
    onOpenChange(false);

    // Reset form
    setSelectedLabelIds(new Set());
    setFreeText('');
  };

  const hasContent = selectedLabelIds.size > 0 || freeText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border/50">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-gold/20 to-teal/20 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(199,167,108,0.2)]">
            <Star className="w-7 h-7 text-gold" />
          </div>
          <DialogTitle className="font-display text-2xl font-semibold text-foreground">
            How was {propertyName}?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            Share your experience to help others find their perfect stay
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Label chips section */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              What stood out?
            </h3>
            <div className="flex flex-wrap gap-2">
              {REVIEW_LABELS.map((label) => (
                <ReviewLabelChip
                  key={label.id}
                  label={label.label}
                  emoji={label.emoji}
                  selected={selectedLabelIds.has(label.id)}
                  onToggle={() => toggleLabel(label.id)}
                />
              ))}
            </div>
          </div>

          {/* Free text section */}
          <div>
            <label htmlFor="review-text" className="text-sm font-medium text-foreground mb-2 block">
              What did you love most?
            </label>
            <Textarea
              id="review-text"
              placeholder="The views were incredible, and the host went above and beyond..."
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className={cn(
                "min-h-[100px] resize-none",
                "bg-background/50 border-border/50",
                "focus:border-gold/50 focus:ring-gold/20",
                "placeholder:text-muted-foreground/60"
              )}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {freeText.length}/500
            </p>
          </div>

          {/* Review summary */}
          <ReviewSummaryCard
            selectedLabels={selectedLabels}
            freeText={freeText}
          />

          {/* Helper note */}
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-gold/70" />
            Your feedback helps improve future recommendations
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Maybe later
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasContent || isSubmitting}
            className={cn(
              "flex-1 gap-2",
              "bg-gradient-to-r from-gold to-gold/80 text-charcoal",
              "hover:shadow-lg hover:shadow-gold/20",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Review
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
