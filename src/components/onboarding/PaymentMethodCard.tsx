import { cn } from '@/lib/utils';
import { Check, Building, CreditCard, DollarSign, Calendar } from 'lucide-react';

interface PaymentMethodCardProps {
  type: 'guest_admin_fee' | 'business_invoice';
  selected: boolean;
  onClick: () => void;
  countryCode: string;
}

export function PaymentMethodCard({
  type,
  selected,
  onClick,
  countryCode,
}: PaymentMethodCardProps) {
  const isPayAtProperty = type === 'guest_admin_fee';
  const feeAmount = countryCode === 'AU' ? 'A$12.00' : 'NZ$8.99';
  const exampleRate = countryCode === 'AU' ? 'A$200' : 'NZ$200';
  const exampleBalance = countryCode === 'AU' ? 'A$188' : 'NZ$191.01';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full p-5 rounded-2xl border-2 text-left transition-all duration-300 group',
        selected
          ? 'border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg'
          : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-md'
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-glow-gold">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Icon and title */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          )}
        >
          {isPayAtProperty ? <Building className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
        </div>
        <div className="flex-1 pr-8">
          <h4 className="text-lg font-semibold text-foreground mb-1">
            {isPayAtProperty ? 'Pay at Property' : 'Guest Pays Now'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {isPayAtProperty
              ? 'Guest pays admin fee online, balance at property'
              : 'Guest pays full amount upfront (non-refundable)'}
          </p>
        </div>
      </div>

      {/* Feature list */}
      <div className="space-y-2 mb-4">
        {isPayAtProperty ? (
          <>
            <FeatureRow icon={DollarSign} text={`Guest pays ${feeAmount} admin fee on acceptance`} />
            <FeatureRow icon={Building} text="Balance paid directly at your property" />
            <FeatureRow icon={Calendar} text="No monthly invoicing for you" />
          </>
        ) : (
          <>
            <FeatureRow icon={CreditCard} text="Guest pays full accommodation upfront" />
            <FeatureRow icon={DollarSign} text="Payment is non-refundable" />
            <FeatureRow icon={Calendar} text={`You're invoiced ${feeAmount}/booking monthly`} />
          </>
        )}
      </div>

      {/* Mini fee breakdown */}
      <div
        className={cn(
          'rounded-xl p-3 transition-colors',
          selected ? 'bg-secondary/10' : 'bg-muted/30'
        )}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Example: {exampleRate}/night booking
        </p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground">Guest pays now</span>
          <span className="font-semibold text-primary">
            {isPayAtProperty ? feeAmount : exampleRate}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-muted-foreground">
            {isPayAtProperty ? 'At property' : 'Your fee (invoiced)'}
          </span>
          <span className="text-foreground">
            {isPayAtProperty ? exampleBalance : feeAmount}
          </span>
        </div>
      </div>
    </button>
  );
}

function FeatureRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
