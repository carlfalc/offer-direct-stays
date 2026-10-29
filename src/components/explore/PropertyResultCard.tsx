import { Property } from '@/types';
import { MapPin, Home, Building, Building2, Hotel, BedDouble, Tent, CheckCircle2, CalendarClock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTrip, PropertyPriceEstimate } from '@/contexts/TripContext';
import { cn } from '@/lib/utils';
import SaveToTripButton from './SaveToTripButton';

interface PropertyResultCardProps {
  property: Property;
  onMakeOffer: () => void;
  onViewDetails: () => void;
  onAddToWatchlist?: () => void;
  isWatchlisted?: boolean;
  saved?: boolean;
  onSavedChange?: () => void;
  priceEstimate?: PropertyPriceEstimate;
  view?: 'list' | 'grid';
}

const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel', motel: 'Motel', hostel: 'Hostel', lodge: 'Lodge', apartment: 'Apartment',
  home: 'Home', home_apartment: 'Home', house: 'House', cabin: 'Cabin', cottage: 'Cottage',
  bach: 'Bach', resort: 'Resort', bnb: 'B&B', holiday_park: 'Holiday park',
};

function typeIconFor(property: Property): LucideIcon {
  const t = (property.property_type || '').toLowerCase();
  if (['home', 'house', 'cabin', 'cottage', 'bach'].includes(t)) return Home;
  if (['apartment', 'home_apartment'].includes(t)) return Building;
  if (t === 'hotel') return Hotel;
  if (['motel', 'lodge', 'resort'].includes(t)) return Building2;
  if (t === 'bnb') return BedDouble;
  if (t === 'holiday_park') return Tent;
  if (property.category === 'homes') return Home;
  if (property.category === 'parks') return Tent;
  return Hotel;
}

function scoreWord(r: number): string {
  if (r >= 9) return 'Exceptional';
  if (r >= 8.5) return 'Superb';
  if (r >= 8) return 'Very good';
  if (r >= 7) return 'Good';
  return 'Pleasant';
}

export default function PropertyResultCard({
  property, onMakeOffer, onViewDetails, saved, onSavedChange, priceEstimate, view = 'list',
}: PropertyResultCardProps) {
  const { trip } = useTrip();
  const TypeIcon = typeIconFor(property);
  const sym = trip.currency === 'AUD' ? 'A$' : 'NZ$';
  const grid = view === 'grid';

  const typeLabel = TYPE_LABELS[property.property_type] || 'Stay';
  const registered = property.registration_status === 'registered' || property.is_claimed;

  const payLine = (() => {
    const t = property.payment_terms;
    if (t === 'upfront') return 'Pay on confirmation';
    if (t === 'days_before' && property.payment_lead_days) return `Pay ${property.payment_lead_days} days before arrival`;
    return 'No prepayment — pay the property direct';
  })();

  const rating = property.rating ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(e) => { if (e.key === 'Enter') onViewDetails(); }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-[0_18px_38px_-22px_rgba(8,22,30,.5)]',
        grid ? 'flex flex-col' : 'grid grid-cols-1 sm:grid-cols-[250px_1fr]',
      )}
    >
      {/* Photo */}
      <div
        className={cn('relative bg-muted bg-cover bg-center', grid ? 'aspect-[16/10]' : 'min-h-[190px]')}
        style={property.image_url ? { backgroundImage: `url('${property.image_url}')` } : undefined}
      >
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-[rgba(12,26,34,.82)] px-2 py-1 text-[0.7rem] font-bold text-white">
          <TypeIcon className="h-3 w-3" /> {typeLabel}{registered ? ' · Registered' : ''}
        </span>
        <SaveToTripButton property={property} saved={saved} onChange={onSavedChange} className="absolute right-2.5 top-2.5 z-10" />
      </div>

      {/* Body */}
      <div className={cn('grid gap-3 p-4', grid ? '' : 'sm:grid-cols-[1fr_auto]')}>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-foreground">{property.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.95rem] font-bold text-[#0C1A22]">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{property.area ? `${property.area}, ` : ''}{property.city}</span>
          </div>
          <div className="mt-2 inline-flex w-max items-center gap-1.5 rounded-md bg-muted/70 px-2 py-0.5 text-xs text-foreground">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" /> {typeLabel}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[#0C1A22]">
            {property.payment_terms === 'days_before'
              ? <CalendarClock className="h-3.5 w-3.5" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
            {payLine}
          </div>
        </div>

        <div className={cn('flex flex-col gap-2', grid ? 'items-start' : 'items-start sm:items-end sm:text-right')}>
          {rating ? (
            <div className={cn('flex items-center gap-2', grid ? '' : 'sm:justify-end')}>
              <div className="leading-tight text-muted-foreground">
                <div className="text-xs font-semibold text-foreground">{scoreWord(rating)}</div>
                {property.review_count ? <div className="text-[0.7rem]">{property.review_count.toLocaleString()} reviews</div> : null}
              </div>
              <span className="rounded-md rounded-bl-none bg-foreground px-1.5 py-0.5 font-display text-sm font-bold text-background">{rating.toFixed(1)}</span>
            </div>
          ) : null}

          <div className="leading-tight">
            {property.guide_min != null ? (
              <>
                <div className="font-display text-xl font-extrabold text-foreground">
                  {sym}{Math.round(property.guide_min)}{property.guide_max != null && property.guide_max !== property.guide_min ? `–${sym}${Math.round(property.guide_max)}` : ''}
                </div>
                <div className="text-[0.72rem] text-muted-foreground">from /night · you name it</div>
              </>
            ) : priceEstimate ? (
              <>
                <div className="font-display text-xl font-extrabold text-foreground">{sym}{priceEstimate.low}–{priceEstimate.high}</div>
                <div className="text-[0.72rem] text-muted-foreground">typical /night · you name it</div>
              </>
            ) : (
              <div className="font-display text-base font-bold text-foreground">You name the price</div>
            )}
          </div>

          <button
            className="rounded-lg bg-foreground px-4 py-2.5 font-display text-sm font-bold text-background transition hover:opacity-90"
            onClick={(e) => { e.stopPropagation(); onMakeOffer(); }}
          >
            Make an offer
          </button>
        </div>
      </div>
    </div>
  );
}
