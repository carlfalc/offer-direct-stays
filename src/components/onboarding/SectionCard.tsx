import { cn } from '@/lib/utils';
import { LucideIcon, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SectionCardProps {
  title: string;
  description?: string;
  tooltip?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  tooltip,
  icon: Icon,
  children,
  className,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border/50 shadow-sm p-6 transition-all duration-200 hover:shadow-md',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
