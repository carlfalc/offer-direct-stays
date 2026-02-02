import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface PremiumProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function PremiumProgressIndicator({
  currentStep,
  totalSteps,
  labels = ['Business Details', 'Link Properties'],
}: PremiumProgressIndicatorProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = currentStep > stepNumber;
          const isActive = currentStep === stepNumber;

          return (
            <div key={stepNumber} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300',
                    isCompleted && 'bg-primary text-primary-foreground shadow-glow-gold',
                    isActive && 'bg-primary text-primary-foreground shadow-glow-gold animate-pulse-soft',
                    !isCompleted && !isActive && 'bg-muted/50 text-muted-foreground border border-border'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {labels[i] && (
                  <span
                    className={cn(
                      'absolute -bottom-6 text-xs font-medium whitespace-nowrap transition-colors',
                      isActive || isCompleted ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {labels[i]}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {stepNumber < totalSteps && (
                <div className="flex-1 mx-3">
                  <div
                    className={cn(
                      'h-1 rounded-full transition-all duration-500',
                      currentStep > stepNumber
                        ? 'bg-gradient-to-r from-primary to-primary/70'
                        : 'bg-muted/30'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
