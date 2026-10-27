import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import PaymentMethodsCard from '@/components/business/PaymentMethodsCard';
import { Loader2, ArrowLeft } from 'lucide-react';

/** Dedicated payment-settings page — its own home, with a magazine header. */
export default function BusinessPayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('fs_listings')
        .select('id,name,payment_methods,payment_note,payment_terms,payment_lead_days')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setListing(data);
      setLoading(false);
    };
    run();
  }, [user]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!listing) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-muted-foreground">Claim your property first to set payment options.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-7">
      <button onClick={() => navigate('/business/dashboard')} className="flex items-center gap-1 font-mono text-xs text-[#0C1A22]/60 hover:text-[#0C1A22]">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </button>

      {/* Magazine header */}
      <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] text-[#0C1A22] sm:text-5xl">Here are your<br />payment settings</h1>
      <p className="mt-2 text-lg font-semibold text-[#0C1A22]">Make any changes you need — they take effect straight away.</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <PaymentMethodsCard
          listingId={listing.id}
          initialMethods={listing.payment_methods || []}
          initialNote={listing.payment_note || ''}
          initialTerms={listing.payment_terms || 'on_arrival'}
          initialLeadDays={listing.payment_lead_days || 10}
          hideHeader
        />
      </div>
    </div>
  );
}
