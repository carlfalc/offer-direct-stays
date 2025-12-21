import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, ArrowLeft, MapPin, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  offer_id: string;
  guest_user_id: string;
  business_user_id: string | null;
  is_unlocked: boolean;
  last_message_at: string;
  created_at: string;
  offer: {
    id: string;
    status: string;
    property: {
      id: string;
      name: string;
      city: string;
      country: string;
      business_id: string | null;
      business?: {
        business_name: string;
      } | null;
    };
  };
  guest_profile?: {
    first_name: string | null;
  } | null;
  last_message?: {
    content: string;
    created_at: string;
    sender_user_id: string;
  } | null;
}

export default function Messages() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'guest' | 'business' | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // First determine user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const role = roleData?.role === 'business' ? 'business' : 'guest';
      setUserRole(role);

      // Fetch conversations where user is participant
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          offer_id,
          guest_user_id,
          business_user_id,
          is_unlocked,
          last_message_at,
          created_at
        `)
        .or(`guest_user_id.eq.${user.id},business_user_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (convError) {
        console.error('Error loading conversations:', convError);
        setLoading(false);
        return;
      }

      if (!convData || convData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Fetch related offer and property data
      const conversationsWithDetails = await Promise.all(
        convData.map(async (conv) => {
          // Get offer with property
          const { data: offerData } = await supabase
            .from('offers')
            .select(`
              id,
              status,
              property:property_id (
                id,
                name,
                city,
                country,
                business_id
              )
            `)
            .eq('id', conv.offer_id)
            .single();

          // Get business name if property has business
          let businessName = null;
          if (offerData?.property?.business_id) {
            const { data: businessData } = await supabase
              .from('businesses')
              .select('business_name')
              .eq('id', offerData.property.business_id)
              .single();
            businessName = businessData?.business_name;
          }

          // Get guest profile if user is business
          let guestProfile = null;
          if (role === 'business' && conv.guest_user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name')
              .eq('user_id', conv.guest_user_id)
              .single();
            guestProfile = profileData;
          }

          // Get last message
          const { data: messagesData } = await supabase
            .from('messages')
            .select('content, created_at, sender_user_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...conv,
            offer: {
              ...offerData,
              property: {
                ...offerData?.property,
                business: businessName ? { business_name: businessName } : null,
              },
            },
            guest_profile: guestProfile,
            last_message: messagesData?.[0] || null,
          } as Conversation;
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherPartyLabel = (conv: Conversation) => {
    if (userRole === 'guest') {
      return conv.offer?.property?.business?.business_name || conv.offer?.property?.name || 'Property';
    } else {
      return conv.guest_profile?.first_name || 'Guest';
    }
  };

  const getStatusBadge = (status: string, isUnlocked: boolean) => {
    if (!isUnlocked) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Locked
        </Badge>
      );
    }

    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Confirmed</Badge>;
      case 'accepted':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Accepted</Badge>;
      case 'countered':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Countered</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-foreground">Messages</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No messages yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Once an offer is confirmed, you'll be able to chat here.
            </p>
            <Button 
              className="mt-6" 
              onClick={() => navigate(userRole === 'business' ? '/business/dashboard' : '/offers')}
            >
              View Your Offers
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                  !conv.is_unlocked ? 'opacity-70' : ''
                }`}
                onClick={() => navigate(`/messages/${conv.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">
                        {getOtherPartyLabel(conv)}
                      </span>
                      {getStatusBadge(conv.offer?.status, conv.is_unlocked)}
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">
                        {conv.offer?.property?.name} • {conv.offer?.property?.city}
                      </span>
                    </div>

                    {conv.last_message ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message.sender_user_id === user?.id ? 'You: ' : ''}
                        {conv.last_message.content}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {conv.is_unlocked ? 'No messages yet' : 'Chat unlocks after confirmation'}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {conv.last_message_at && format(new Date(conv.last_message_at), 'MMM d')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}