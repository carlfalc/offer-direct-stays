import { useState, useEffect } from 'react';
import { Property, Room } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/ui/stepper';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';
import OfferSlider from './OfferSlider';
import RoomPicker from './RoomPicker';
import { loadLiteApiRoomContent } from '@/lib/listings';

interface OfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
  initialAdults?: number;
  initialChildren?: number;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onOfferSent?: (propertyId: string) => void;
}

export default function OfferModal({
  open,
  onOpenChange,
  property,
  initialAdults = 2,
  initialChildren = 0,
  initialCheckIn,
  initialCheckOut,
  onOfferSent,
}: OfferModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Form state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [requirements, setRequirements] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_property' | 'pay_now'>('pay_at_property');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [engineListingId, setEngineListingId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  // Currency and BCF based on property country
  const currency = property?.country === 'AU' ? 'AUD' : 'NZD';
  const bcfAmount = property?.country === 'AU' ? 12.0 : 8.99;

  // Offer slider sweet spot — from the selected room's public guide when available.
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;
  const guide = selectedRoom?.avg_rate ?? null;
  const sweetHi = guide ? Math.round(guide) : 230;
  const sweetLo = guide ? Math.round(guide * 0.82) : 180;
  const sliderMin = Math.round(sweetLo * 0.6);
  const sliderMax = sweetHi; // cap at the property's actual price — never offer above it
  const midpoint = sweetHi;  // the handle starts at the real price; traveller drags down

  // Reset form when property changes
  useEffect(() => {
    if (property) {
      setSelectedRoomId(null);
      setAdults(initialAdults);
      setChildren(initialChildren);
      setRequirements('');
      setOfferAmount(String(midpoint));
      setPaymentMethod('pay_at_property');
      setError(null);
      setEngineListingId(null);
      // Use the traveller's searched dates when we have them; only fall back to
      // a default window if the search didn't carry dates.
      const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      const d1 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const d2 = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
      setCheckIn(isISO(initialCheckIn) ? initialCheckIn! : d1);
      setCheckOut(isISO(initialCheckOut) ? initialCheckOut! : d2);
      loadRooms(property.id);
    }
  }, [property, initialAdults, initialChildren, initialCheckIn, initialCheckOut]);

  const loadRooms = async (propertyId: string) => {
    setLoadingRooms(true);
    try {
      if (propertyId.startsWith('lp')) {
        // Active findastay listing? Load its engine rooms (with public guide price).
        const { data: listing } = await supabase
          .from('fs_listings')
          .select('id,status')
          .eq('liteapi_hotel_id', propertyId)
          .maybeSingle();
        if (listing && (listing as any).status === 'active') {
          setEngineListingId((listing as any).id);
          const { data: lrooms } = await supabase
            .from('fs_listing_rooms')
            .select('id,liteapi_room_id,room_name,max_adults,max_children,max_occupancy,base_guide')
            .eq('listing_id', (listing as any).id)
            .order('room_name');
          // Attach LiteAPI photos/size to each engine room by its liteapi_room_id.
          const content = await loadLiteApiRoomContent(propertyId);
          const mapped: Room[] = ((lrooms as any[]) || []).map((r) => {
            const c = content[String(r.liteapi_room_id)] || {};
            return {
              id: r.id,
              property_id: propertyId,
              name: r.room_name,
              description: c.description ?? null,
              max_adults: r.max_adults ?? 2,
              max_children: r.max_children ?? 0,
              max_occupancy: r.max_occupancy ?? c.max_occupancy ?? null,
              size_sqm: c.size_sqm ?? null,
              images: c.images ?? null,
              image_url: c.images?.[0] ?? null,
              bed_configuration: null,
              amenities: null,
              avg_rate: r.base_guide ?? null,
              actual_rate: null,
              currency: 'NZD',
              created_at: '',
              updated_at: '',
            };
          });
          setRooms(mapped);
          return;
        }
      }
      const { data, error } = await supabase.from('rooms').select('*').eq('property_id', propertyId).order('name');
      if (error) console.error('Error loading rooms:', error);
      else setRooms((data as Room[]) || []);
    } catch (e) {
      console.error('Error loading rooms:', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleSubmit = async (overrideRoomId?: string, overrideAmount?: number) => {
    if (!property || !user) return;

    const roomId = overrideRoomId ?? selectedRoomId;
    const amount = overrideAmount ?? parseFloat(offerAmount);

    // Keep form state in sync when the offer comes from the room gallery.
    if (overrideRoomId) setSelectedRoomId(overrideRoomId);
    if (overrideAmount != null) setOfferAmount(String(overrideAmount));

    if (isNaN(amount) || amount < 20) {
      setError('Offer amount looks too low — please adjust');
      return;
    }
    if (amount > 5000) {
      setError('Offer amount looks too high — please adjust');
      return;
    }
    setError(null);

    setIsSubmitting(true);

    // New offer engine (claimed/active findastay listings) → fs_submit_offer
    if (engineListingId) {
      if (!roomId) {
        setIsSubmitting(false);
        setError('Please choose a room first');
        return;
      }
      const { error: rpcError } = await supabase.rpc('fs_submit_offer', {
        p_room: roomId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_adults: adults,
        p_children: children,
        p_nightly: amount,
        p_message: requirements.trim() || null,
      } as any);
      setIsSubmitting(false);
      if (rpcError) {
        toast({
          title: 'Could not send offer',
          description: rpcError.message || 'Please try again',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Offer sent',
        description: "We'll notify you the moment the property responds — you'll then have 1 hour to confirm.",
      });
      onOfferSent?.(property.id);
      onOpenChange(false);
      return;
    }

    // Calculate dates (MVP: use today and tomorrow as defaults)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkInDate = today.toISOString().split('T')[0];
    const checkOutDate = tomorrow.toISOString().split('T')[0];

    const { error: insertError } = await supabase.from('offers').insert({
      guest_user_id: user.id,
      property_id: property.id,
      room_id: roomId,
      offer_amount: amount,
      adults,
      children,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      guest_notes: requirements.trim() || null,
      status: 'submitted',
      payment_method: paymentMethod,
      bcf_payment_status: 'pending',
      bcf_currency: currency,
      bcf_amount: bcfAmount,
    });

    setIsSubmitting(false);

    if (insertError) {
      console.error('Error creating offer:', insertError);
      const isLimit = insertError.message?.toLowerCase().includes('offer limit');
      toast({
        title: isLimit ? 'Offer limit reached' : 'Error',
        description: isLimit
          ? 'You can send up to 5 active offers per city within 2 hours. Please wait and try again.'
          : (insertError.message || 'Something went wrong sending your offer. Please try again.'),
        variant: 'destructive',
      });
      return;
    }

    // Log offer event (non-blocking)
    supabase.from('property_events').insert({
      property_id: property.id,
      user_id: user.id,
      event_type: 'offer_submitted',
      metadata: { payment_method: paymentMethod, room_id: roomId || null }
    }).then(({ error }) => {
      if (error) console.warn('Event log failed', error.message);
    });

    toast({
      title: 'Offer sent',
      description: "You'll be notified if the business accepts or counters.",
    });

    onOfferSent?.(property.id);
    onOpenChange(false);
  };

  const offerNum = parseFloat(offerAmount);
  const sliderVal = isNaN(offerNum) ? midpoint : Math.min(sliderMax, Math.max(sliderMin, offerNum));

  // Inline JSX to prevent remount on state changes (fixes scroll jump)
  const modalContent = (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-6 py-4">
        {/* Property Header Block */}
        {property && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{property.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {property.city}
                {property.area && `, ${property.area}`}, {property.country}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {property.is_claimed ? (
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  Registered
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Unclaimed
                </Badge>
              )}
            </div>
            {!property.is_claimed && (
              <p className="text-xs text-muted-foreground">
                This property may need to claim their listing before they can respond. We’ll email the owner to claim it.
              </p>
            )}
          </div>
        )}

        {/* Room Selection */}
        <div className="space-y-2">
          <div>
            <label className="text-sm font-medium text-foreground">Choose a room</label>
            {rooms.length > 0 && (
              <p className="text-xs text-muted-foreground">Tap a photo to view the room, then pick the one you want to offer on.</p>
            )}
          </div>
          {loadingRooms ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading rooms...
            </div>
          ) : rooms.length > 0 ? (
            <RoomPicker
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              currency={currency}
              isSubmitting={isSubmitting}
              onSelect={(v) => {
                setSelectedRoomId(v || null);
                const rm = rooms.find((r) => r.id === v);
                if (rm?.avg_rate) {
                  setOfferAmount(String(Math.round(rm.avg_rate))); // start at the real price
                }
                setError(null);
              }}
              onSubmitOffer={(roomId, amount) => handleSubmit(roomId, amount)}
            />
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">No rooms listed yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can still send an offer and the business can match you with the closest room type.
              </p>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Dates</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">Check-in</span>
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Check-out</span>
              <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Guests */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Guests</label>
          <div className="flex items-center gap-6">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={10} />
            <Stepper label="Children" value={children} onChange={setChildren} min={0} max={10} />
          </div>
          <p className="text-xs text-muted-foreground">
            This helps the business confirm the room is suitable.
          </p>
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Any requirements? (optional)</label>
          <Textarea
            placeholder="Parking, accessibility needs, late arrival, quiet room, pets, etc."
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="resize-none"
            rows={3}
          />
        </div>

        {/* Offer slider — brand sweet-spot guidance */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Your offer per night</label>
          <OfferSlider
            value={sliderVal}
            min={sliderMin}
            max={sliderMax}
            sweetLo={sweetLo}
            sweetHi={sweetHi}
            currency={currency}
            onChange={(v) => { setOfferAmount(String(v)); setError(null); }}
          />
          <p className="text-xs text-muted-foreground">
            Guests usually land between <span className="font-medium">{currency} ${sweetLo}–${sweetHi}</span> for stays like this. Drag to your number — you’re always in control.
          </p>
        </div>

        {/* Offer Price Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Or type an exact amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {currency}
            </span>
            <Input
              type="number"
              placeholder="e.g. 180"
              value={offerAmount}
              onChange={(e) => {
                setOfferAmount(e.target.value);
                setError(null);
              }}
              className="pl-12"
              min={20}
              max={5000}
            />
          </div>
          {error ? (
            <div className="flex items-center gap-1.5 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Your offer is sent directly to the business. If accepted, you'll be asked to confirm payment.
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">How do you want to pay?</Label>
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'pay_at_property' | 'pay_now')}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="pay_at_property" id="pay_at_property" />
              <Label htmlFor="pay_at_property" className="text-sm text-foreground">
                Pay at property (you'll pay the booking commitment fee to confirm)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="pay_now" id="pay_now" />
              <Label htmlFor="pay_now" className="text-sm text-foreground">
                Pay now (full amount online once the business accepts)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* BCF Disclosure */}
        <div className="rounded-lg bg-accent p-3 space-y-1">
          <p className="text-sm font-medium text-accent-foreground">Booking commitment fee</p>
          <p className="text-sm text-accent-foreground/80">
            If the business accepts, you'll pay a non-refundable{' '}
            <span className="font-semibold">
              {currency} ${bcfAmount.toFixed(2)}
            </span>{' '}
            to confirm.
          </p>
          <p className="text-xs text-accent-foreground/70">
            This fee is deducted from what you pay the property.
          </p>
        </div>
      </div>
    </ScrollArea>
  );

  const modalFooter = (
    <div className="flex gap-3 pt-4 border-t border-border">
      <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button className="flex-1" onClick={() => handleSubmit()} disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          'Send offer'
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Make an offer</DrawerTitle>
            <DrawerDescription>
              Choose a room and name your nightly offer. If the business accepts, you'll pay a non-refundable
              booking commitment fee to confirm.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {modalContent}
            {modalFooter}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
          <DialogDescription>
            Choose a room and name your nightly offer. If the business accepts, you'll pay a non-refundable
            booking commitment fee to confirm.
          </DialogDescription>
        </DialogHeader>
        {modalContent}
        {modalFooter}
      </DialogContent>
    </Dialog>
  );
}
