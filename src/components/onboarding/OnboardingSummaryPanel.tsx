import { Building2, Mail, MapPin, CreditCard, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingSummaryPanelProps {
  businessName: string;
  location: string;
  businessEmail: string;
  billingEmail: string;
  paymentMethod: string;
  countryCode: string;
}

export function OnboardingSummaryPanel({
  businessName,
  location,
  businessEmail,
  billingEmail,
  paymentMethod,
  countryCode,
}: OnboardingSummaryPanelProps) {
  const getFeeAmount = () => countryCode === 'AU' ? 'A$12.00' : 'NZ$8.99';
  
  const getPaymentMethodLabel = () => {
    if (paymentMethod === 'guest_admin_fee') {
      return 'Pay at Property';
    }
    return 'Guest Pays Now';
  };

  const items = [
    {
      icon: Building2,
      label: 'Business',
      value: businessName || 'Not entered',
      filled: !!businessName,
    },
    {
      icon: MapPin,
      label: 'Location',
      value: location || 'Not entered',
      filled: !!location,
    },
    {
      icon: Mail,
      label: 'Contact',
      value: businessEmail || 'Not entered',
      filled: !!businessEmail,
    },
    {
      icon: Mail,
      label: 'Billing',
      value: billingEmail || 'Same as contact',
      filled: !!billingEmail,
    },
    {
      icon: CreditCard,
      label: 'Fee Option',
      value: `${getPaymentMethodLabel()} • ${getFeeAmount()}`,
      filled: true,
    },
  ];

  const filledCount = items.filter((item) => item.filled).length;
  const progress = (filledCount / items.length) * 100;

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden">
      {/* Header with progress */}
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-secondary/5 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Your Business</h3>
          <span className="text-xs text-muted-foreground">{filledCount}/{items.length} complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Summary items */}
      <div className="p-4 space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl transition-all duration-200',
              item.filled ? 'bg-primary/5' : 'bg-muted/20'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                item.filled ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {item.label}
              </p>
              <p
                className={cn(
                  'text-sm truncate',
                  item.filled ? 'text-foreground font-medium' : 'text-muted-foreground/70 italic'
                )}
              >
                {item.value}
              </p>
            </div>
            {item.filled && (
              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
