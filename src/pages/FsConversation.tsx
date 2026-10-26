import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft, Lock, Send, ShieldCheck } from 'lucide-react';
import { commitmentFee, balancePayable, scanMessage, threadLocked } from '@/lib/messaging';

interface Msg { id: string; sender_id: string | null; kind: string; body: string; created_at: string; }

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });

export default function FsConversation() {
  const { conversationId: offerId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<any | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(async () => {
    if (!user || !offerId) return;
    await supabase.from('fs_thread_reads').upsert({ offer_id: offerId, user_id: user.id, last_read_at: new Date().toISOString() } as any, { onConflict: 'offer_id,user_id' });
  }, [user, offerId]);

  const load = useCallback(async () => {
    if (!user || !offerId) return;
    const { data: o } = await supabase
      .from('fs_offers')
      .select('id,traveller_id,listing_id,check_in,check_out,nights,adults,children,nightly_offer,total_offer,booking_number,status,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,country,owner_id)')
      .eq('id', offerId)
      .maybeSingle();
    if (!o || (o as any).status !== 'confirmed') { navigate('/messages'); return; }
    setOffer(o);
    const { data: m } = await supabase
      .from('fs_messages')
      .select('id,sender_id,kind,body,created_at')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: true });
    setMessages((m as any[]) || []);
    setLoading(false);
    markRead();
  }, [user, offerId, navigate, markRead]);

  useEffect(() => { load(); }, [load]);

  // live updates
  useEffect(() => {
    if (!offerId) return;
    const ch = supabase
      .channel(`fs_messages:${offerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fs_messages', filter: `offer_id=eq.${offerId}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.sender_id !== user?.id) markRead();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [offerId, user?.id, markRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const currency = offer?.listing?.country === 'AU' ? 'AUD' : 'NZD';
  const sym = currency === 'AUD' ? 'A$' : 'NZ$';
  const iAmOwner = offer?.listing?.owner_id === user?.id;
  const otherName = iAmOwner ? `Guest · ${offer?.booking_number || 'booking'}` : (offer?.listing?.name || 'Property');
  const locked = offer ? threadLocked(offer.check_out) : false;

  const send = async () => {
    const text = body.trim();
    if (!text || !offerId || !user) return;
    const scan = scanMessage(text);
    if (!scan.ok) { toast({ title: 'Can’t send that', description: scan.reason, variant: 'destructive' }); return; }
    setSending(true);
    const { data, error } = await supabase
      .from('fs_messages')
      .insert({ offer_id: offerId, sender_id: user.id, kind: 'user', body: text } as any)
      .select('id,sender_id,kind,body,created_at')
      .single();
    setSending(false);
    if (error) { toast({ title: 'Could not send', description: error.message, variant: 'destructive' }); return; }
    setMessages((cur) => (cur.some((x) => x.id === (data as any).id) ? cur : [...cur, data as any]));
    setBody('');
    markRead();
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fee = commitmentFee(currency);
  const balance = balancePayable(Number(offer.total_offer), currency);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-4 py-4">
      <button onClick={() => navigate('/messages')} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Messages
      </button>

      {/* Deal summary — locked, system-generated */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-foreground">{otherName}</p>
            <p className="text-xs text-muted-foreground">{offer.room?.room_name || 'Room'} · {fmtDate(offer.check_in)}–{fmtDate(offer.check_out)} · {offer.nights}n · {offer.adults + offer.children} guests</p>
          </div>
          {offer.booking_number && <span className="flex-none rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{offer.booking_number}</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground">Agreed total</p>
            <p className="font-semibold text-foreground">{sym}{Math.round(Number(offer.total_offer))}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground">Fee paid to findastay</p>
            <p className="font-semibold text-foreground">−{sym}{fee}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-[11px] text-muted-foreground">Balance to property</p>
            <p className="font-semibold text-primary">{sym}{balance.toFixed(2)}</p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 flex-none" /> The property collects the balance directly. Never share card numbers here.
        </p>
      </div>

      {/* Messages */}
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. {iAmOwner ? 'Send your guest their payment details and arrival info.' : 'Say hello and sort out your stay details.'}</p>
        ) : messages.map((m) => {
          if (m.kind === 'system') {
            return <p key={m.id} className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">{m.body}</p>;
          }
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-0.5 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{fmtTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {locked ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> This conversation closed 10 days after checkout.
        </div>
      ) : (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Write a message…"
            className="min-h-[44px] max-h-32 flex-1 resize-none"
          />
          <Button onClick={send} disabled={sending || !body.trim()} className="h-11">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
