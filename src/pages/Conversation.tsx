import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import VoiceMicButton from '@/components/VoiceMicButton';
import { ArrowLeft, Send, Lock, MapPin, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_user_id: string;
  created_at: string;
  is_read: boolean;
}

interface ConversationDetails {
  id: string;
  offer_id: string;
  guest_user_id: string;
  business_user_id: string | null;
  is_unlocked: boolean;
  offer: {
    id: string;
    status: string;
    check_in_date: string;
    check_out_date: string;
    property: {
      id: string;
      name: string;
      city: string;
      country: string;
    };
  };
  other_party_name: string;
}

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [userRole, setUserRole] = useState<'guest' | 'business' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && conversationId) {
      loadConversation();
      loadMessages();
      subscribeToMessages();
    }
  }, [user, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    if (!user || !conversationId) return;

    try {
      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const role = roleData?.role === 'business' ? 'business' : 'guest';
      setUserRole(role);

      // Get conversation
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, offer_id, guest_user_id, business_user_id, is_unlocked')
        .eq('id', conversationId)
        .single();

      if (convError || !convData) {
        console.error('Error loading conversation:', convError);
        navigate('/messages');
        return;
      }

      // Check user is participant
      if (convData.guest_user_id !== user.id && convData.business_user_id !== user.id) {
        toast({
          title: 'Access denied',
          description: 'You are not a participant in this conversation.',
          variant: 'destructive',
        });
        navigate('/messages');
        return;
      }

      // Get offer and property
      const { data: offerData } = await supabase
        .from('offers')
        .select(`
          id,
          status,
          check_in_date,
          check_out_date,
          property:property_id (
            id,
            name,
            city,
            country,
            business_id
          )
        `)
        .eq('id', convData.offer_id)
        .single();

      // Get other party name
      let otherPartyName = 'Unknown';
      if (role === 'guest') {
        // Get business name
        if (offerData?.property?.business_id) {
          const { data: businessData } = await supabase
            .from('businesses')
            .select('business_name')
            .eq('id', offerData.property.business_id)
            .single();
          otherPartyName = businessData?.business_name || offerData?.property?.name || 'Property';
        } else {
          otherPartyName = offerData?.property?.name || 'Property';
        }
      } else {
        // Get guest name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('user_id', convData.guest_user_id)
          .single();
        otherPartyName = profileData?.first_name || 'Guest';
      }

      setConversation({
        ...convData,
        offer: offerData as any,
        other_party_name: otherPartyName,
      });
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !conversationId || !conversation?.is_unlocked) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        content: messageContent,
      });

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Failed to send',
          description: error.message,
          variant: 'destructive',
        });
        setNewMessage(messageContent); // Restore message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setNewMessage((prev) => (prev + ' ' + text).trim());
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Conversation not found</h2>
          <Button className="mt-4" onClick={() => navigate('/messages')}>
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Conversation Header (not main nav, just context) */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="container mx-auto px-4 h-12 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">
              {conversation.other_party_name}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{conversation.offer?.property?.name}</span>
            </div>
          </div>
          <Badge
            className={
              conversation.offer?.status === 'confirmed'
                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : 'bg-muted'
            }
          >
            {conversation.offer?.status}
          </Badge>
        </div>
      </div>

      {/* Locked Banner */}
      {!conversation.is_unlocked && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Chat unlocks once the booking is confirmed. Complete payment to start messaging.
          </p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {conversation.is_unlocked
                  ? 'No messages yet. Start the conversation!'
                  : 'Messages will appear here once the booking is confirmed.'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-card flex-shrink-0 p-4">
        <div className="container mx-auto flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              conversation.is_unlocked ? 'Type a message...' : 'Chat locked until confirmation'
            }
            disabled={!conversation.is_unlocked || sending}
            className="flex-1"
          />
          <VoiceMicButton
            onTranscript={handleVoiceTranscript}
            disabled={!conversation.is_unlocked || sending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || !conversation.is_unlocked || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}