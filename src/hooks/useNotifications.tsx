import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Notifications: live unread-message count plus optional desktop (OS) pop-ups —
 * like Outlook — when a new message arrives while the app is open in any tab.
 *
 * Reliable OS pop-ups while the browser is CLOSED need Web Push (service worker
 * + VAPID + a push server). That is a separate, backend-dependent build; this
 * provider delivers the in-app badge and the browser-open desktop pop-up now.
 */

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationsContextType {
  unreadCount: number;
  permission: Permission;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<Permission>(
    supportsNotifications() ? (Notification.permission as Permission) : 'unsupported'
  );
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userIdRef.current) {
      setUnreadCount(0);
      return;
    }
    // RLS limits `messages` to conversations the user is part of, so counting
    // unread messages not sent by me yields my personal unread total.
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_user_id', userIdRef.current);
    if (!error && typeof count === 'number') setUnreadCount(count);
  }, []);

  const fireDesktop = useCallback((title: string, body: string) => {
    if (!supportsNotifications() || Notification.permission !== 'granted') return;
    // Don't buzz the user for a tab they're actively looking at.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'findastay-message',
      });
      n.onclick = () => {
        window.focus();
        window.location.href = '/messages';
        n.close();
      };
    } catch {
      /* some browsers throw if constructed outside a user gesture — ignore */
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supportsNotifications()) {
      setPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
    } catch {
      /* ignore */
    }
  }, []);

  // initial + on user change
  useEffect(() => {
    refresh();
  }, [user, refresh]);

  // realtime: new incoming messages → bump count + desktop pop-up
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { sender_user_id?: string; content?: string };
          if (!msg?.sender_user_id || msg.sender_user_id === userIdRef.current) return;
          setUnreadCount((c) => c + 1);
          fireDesktop('New message · findastay', msg.content?.slice(0, 120) || 'You have a new message');
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fireDesktop]);

  // keep count fresh when the tab regains focus
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, permission, requestPermission, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Safe fallback so components never crash if used outside the provider.
    return {
      unreadCount: 0,
      permission: 'default' as Permission,
      requestPermission: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
