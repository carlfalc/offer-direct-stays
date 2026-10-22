import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Action counts for the nav badges:
 *  - businessPending: offers on my listings that need a response (status 'pending')
 *  - toConfirm: my offers that are accepted/countered and still within the confirm window
 */
export function useFsCounts() {
  const { user } = useAuth();
  const [businessPending, setBusinessPending] = useState(0);
  const [toConfirm, setToConfirm] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setBusinessPending(0);
      setToConfirm(0);
      return;
    }
    try {
      // Business: offers waiting on my listings
      const { data: ls } = await supabase.from('fs_listings').select('id').eq('owner_id', user.id);
      const ids = ((ls as any[]) || []).map((l) => l.id);
      if (ids.length) {
        const { count } = await supabase
          .from('fs_offers')
          .select('id', { count: 'exact', head: true })
          .in('listing_id', ids)
          .eq('status', 'pending');
        setBusinessPending(count || 0);
      } else {
        setBusinessPending(0);
      }

      // Traveller: offers awaiting my confirmation
      const nowISO = new Date().toISOString();
      const { count: c2 } = await supabase
        .from('fs_offers')
        .select('id', { count: 'exact', head: true })
        .eq('traveller_id', user.id)
        .in('status', ['accepted_pending_confirm', 'countered'])
        .not('released_at', 'is', null)
        .gt('confirm_deadline_at', nowISO);
      setToConfirm(c2 || 0);
    } catch {
      /* best-effort badges */
    }
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  return { businessPending, toConfirm, refresh: load };
}
