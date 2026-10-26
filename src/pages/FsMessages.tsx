import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Loader2, MessageSquare, Lock, ChevronRight } from 'lucide-react';
import { threadLocked } from '@/lib/messaging';

interface Row {
  id: string;
  traveller_id: string;
  check_in: string;
  check_out: string;
  booking_number: string | null;
  room?: { room_name: string | null } | null;
  listing?: { name: string | null; city: string | null; owner_id: string | null } | null;
  last?: { body: string; created_at: string; sender_id: string | null } | null;
  unread: number;
}

const fmt = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

export default function FsMessages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // RLS returns only offers where I'm the traveller or the listing owner.
    const { data: offers } = await supabase
      .from('fs_offers')
      .select('id,traveller_id,check_in,check_out,booking_number,room:fs_listing_rooms(room_name),listing:fs_listings(name,city,owner_id)')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false });
    const offs = (offers as any[]) || [];
    const ids = offs.map((o) => o.id);
    let msgs: any[] = [];
    let reads: any[] = [];
    if (ids.length) {
      const [{ data: m }, { data: r }] = await Promise.all([
        supabase.from('fs_messages').select('offer_id,body,created_at,sender_id,kind').in('offer_id', ids).order('created_at', { ascending: true }),
        supabase.from('fs_thread_reads').select('offer_id,last_read_at').eq('user_id', user.id),
      ]);
      msgs = (m as any[]) || [];
      reads = (r as any[]) || [];
    }
    const readBy: Record<string, string> = {};
    reads.forEach((x) => (readBy[x.offer_id] = x.last_read_at));
    setRows(offs.map((o) => {
      const mine = msgs.filter((m) => m.offer_id === o.id);
      const last = mine[mine.length - 1] || null;
      const since = readBy[o.id] ? new Date(readBy[o.id]).getTime() : 0;
      const unread = mine.filter((m) => m.sender_id !== user.id && new Date(m.created_at).getTime() > since).length;
      return { ...o, last, unread };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Chats open once a booking is confirmed, and close 10 days after checkout.</p>

      {rows.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground">When an offer is confirmed, your chat with the property or guest appears here.</p>
        </Card>
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((o) => {
            const iAmOwner = o.listing?.owner_id === user?.id;
            const title = iAmOwner ? `Guest · ${o.booking_number || 'booking'}` : (o.listing?.name || 'Property');
            const locked = threadLocked(o.check_out);
            return (
              <button key={o.id} onClick={() => navigate(`/messages/${o.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:shadow-sm">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    {locked && <Lock className="h-3 w-3 flex-none text-muted-foreground" />}
                    {o.unread > 0 && <span className="ml-auto flex-none rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{o.unread}</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.room?.room_name || 'Room'} · {fmt(o.check_in)}–{fmt(o.check_out)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/80">{o.last ? o.last.body : 'No messages yet — say hello.'}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-none text-muted-foreground/50" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
