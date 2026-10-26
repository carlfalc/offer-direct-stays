import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Megaphone, ClipboardList, Mail, Phone } from 'lucide-react';
import { commitmentFee } from '@/lib/fees';

interface OnboardingReq {
  id: string; contact_name: string | null; email: string; phone: string | null;
  business_name: string | null; company: string | null; role: string | null;
  message: string | null; status: string; created_at: string;
}
interface Lead {
  id: string; property_name: string | null; city: string | null; type: string;
  note: string | null; status: string; created_at: string;
}
interface Booking {
  id: string; booking_number: string | null; nightly_offer: number; total_offer: number;
  nights: number; check_in: string; check_out: string; entered_at: string | null; created_at: string;
  room?: { room_name: string | null } | null;
  listing?: { name: string | null; city: string | null; country: string | null } | null;
}

const fmt = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' });

export default function AdminConsole() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'onboarding' | 'leads' | 'bookings'>('onboarding');
  const [loading, setLoading] = useState(true);
  const [reqs, setReqs] = useState<OnboardingReq[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from('fs_onboarding_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('fs_listing_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('fs_offers')
        .select('id,booking_number,nightly_offer,total_offer,nights,check_in,check_out,entered_at,created_at,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country)')
        .eq('status', 'confirmed').order('created_at', { ascending: false }),
    ]);
    setReqs(((r1.data as any[]) || []) as OnboardingReq[]);
    setLeads(((r2.data as any[]) || []) as Lead[]);
    setBookings(((r3.data as any[]) || []) as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setReqStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('fs_onboarding_requests').update({ status } as any).eq('id', id);
    if (error) { toast({ title: 'Could not update', description: error.message, variant: 'destructive' }); return; }
    setReqs((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const Tab = ({ id, label, icon, count }: { id: typeof tab; label: string; icon: React.ReactNode; count: number }) => (
    <button
      onClick={() => setTab(id)}
      className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition',
        tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted')}
    >
      {icon} {label}
      {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{count}</span>}
    </button>
  );

  const revenueFees = bookings.reduce((s, b) => s + commitmentFee(b.total_offer), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-foreground">Platform admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Onboarding requests, leads, and every booking across findastay.</p>

      {/* summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{reqs.filter((r) => r.status === 'new').length}</p><p className="text-xs text-muted-foreground">New requests</p></Card>
        <Card className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{leads.filter((l) => l.status === 'new').length}</p><p className="text-xs text-muted-foreground">New leads</p></Card>
        <Card className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{bookings.length}</p><p className="text-xs text-muted-foreground">Bookings</p></Card>
        <Card className="p-3 text-center"><p className="text-2xl font-bold text-success">${revenueFees.toFixed(2)}</p><p className="text-xs text-muted-foreground">Fees (est.)</p></Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
        <Tab id="onboarding" label="Onboarding requests" icon={<UserPlus className="h-4 w-4" />} count={reqs.filter((r) => r.status === 'new').length} />
        <Tab id="leads" label="Leads" icon={<Megaphone className="h-4 w-4" />} count={leads.filter((l) => l.status === 'new').length} />
        <Tab id="bookings" label="All bookings" icon={<ClipboardList className="h-4 w-4" />} count={bookings.length} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-5 space-y-3">
          {tab === 'onboarding' && (reqs.length === 0 ? <Empty text="No onboarding requests yet." /> : reqs.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.business_name || '(no business name)'}{r.company ? ` · ${r.company}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{r.contact_name}{r.role ? ` — ${r.role}` : ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="h-3.5 w-3.5" /> {r.email}</a>
                    {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="h-3.5 w-3.5" /> {r.phone}</a>}
                    <span>{fmt(r.created_at)}</span>
                  </div>
                  {r.message && <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{r.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === 'new' ? 'default' : 'outline'} className={r.status !== 'new' ? 'text-muted-foreground' : ''}>{r.status}</Badge>
                  {r.status === 'new' && <Button size="sm" variant="outline" onClick={() => setReqStatus(r.id, 'contacted')}>Mark contacted</Button>}
                  {r.status !== 'done' && <Button size="sm" variant="ghost" onClick={() => setReqStatus(r.id, 'done')}>Done</Button>}
                </div>
              </div>
            </Card>
          )))}

          {tab === 'leads' && (leads.length === 0 ? <Empty text="No leads yet." /> : leads.map((l) => (
            <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{l.property_name || l.id}{l.city ? ` · ${l.city}` : ''}</p>
                <p className="text-xs text-muted-foreground">{l.type === 'owner_claim' ? 'Owner wants to claim' : 'Traveller nudge'}{l.note ? ` — ${l.note}` : ''} · {fmt(l.created_at)}</p>
              </div>
              <Badge variant="outline" className="text-muted-foreground">{l.status}</Badge>
            </Card>
          )))}

          {tab === 'bookings' && (bookings.length === 0 ? <Empty text="No confirmed bookings yet." /> : bookings.map((b) => {
            const cur = b.listing?.country === 'AU' ? 'AUD' : 'NZD';
            return (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{b.listing?.name || 'Property'}</p>
                    {b.booking_number && <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{b.booking_number}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{b.room?.room_name} · {fmt(b.check_in)}–{fmt(b.check_out)} · {cur} ${Math.round(b.total_offer)} · {b.entered_at ? 'entered' : 'not entered'}</p>
                </div>
                <span className="text-xs text-muted-foreground">{fmt(b.created_at)}</span>
              </Card>
            );
          }))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</p>;
}
