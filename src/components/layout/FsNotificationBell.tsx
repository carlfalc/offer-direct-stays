import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell } from 'lucide-react';

interface FsNotif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const BUSINESS_KINDS = new Set(['offer_received', 'offer_auto_accepted']);

function timeAgo(s: string): string {
  const ms = Date.now() - new Date(s).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FsNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FsNotif[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('fs_notifications')
      .select('id,kind,title,body,read_at,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems(((data as any[]) || []) as FsNotif[]);
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((i) => !i.read_at).length;

  const markAllRead = async () => {
    if (unread === 0 || !user) return;
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    setItems((is) => is.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    await supabase.from('fs_notifications').update({ read_at: new Date().toISOString() } as any).in('id', ids);
  };

  if (!user) return null;

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-primary/5 hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 bg-card border-border/50 shadow-xl z-50 p-0">
        <div className="border-b border-border/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <div className="max-h-[22rem] overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(BUSINESS_KINDS.has(n.kind) ? '/business/dashboard' : '/offers')}
                className={cn(
                  'block w-full border-b border-border/30 px-3 py-2.5 text-left transition hover:bg-primary/5',
                  !n.read_at && 'bg-primary/[0.04]',
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
                  <div className={cn('min-w-0', n.read_at && 'pl-3.5')}>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
