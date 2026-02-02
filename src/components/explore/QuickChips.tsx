import { cn } from '@/lib/utils';

interface QuickChipsProps {
  onSelect: (prompt: string) => void;
  className?: string;
}

const QUICK_PROMPTS = [
  { label: 'Gold Coast 3 nights under $200', icon: '🏖️' },
  { label: 'Auckland family stay with parking', icon: '👨‍👩‍👧‍👦' },
  { label: 'Romantic weekend in Queenstown', icon: '💑' },
  { label: 'Sydney CBD business hotel', icon: '💼' },
  { label: 'Melbourne pet-friendly apartment', icon: '🐕' },
];

export default function QuickChips({ onSelect, className }: QuickChipsProps) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {QUICK_PROMPTS.map((prompt, index) => (
        <button
          key={index}
          onClick={() => onSelect(prompt.label)}
          className={cn(
            "quick-chip group flex items-center gap-2",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <span className="text-base">{prompt.icon}</span>
          <span>{prompt.label}</span>
        </button>
      ))}
    </div>
  );
}
