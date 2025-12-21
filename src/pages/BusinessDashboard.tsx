import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users, DollarSign, ArrowLeft, Inbox, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface BusinessOffer {
  id: string;
  offer_amount: number;
  counter_amount: number | null;
  status: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  updated_at: string;
  guest_user_id: string;
  property: {
    id: string;
    name: string;
  } | null;
  guest_profile: {
    first_name: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'New Offer', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'secondary' },
  countered: { label: 'Countered', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const statusTabs = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'countered', label: 'Countered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
];

export default function BusinessDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<BusinessOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/business/dashboard');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function fetchBusinessAndOffers() {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // First, get the business for this user
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (businessError) {
          console.error('Error fetching business:', businessError);
          setError('Failed to load business');
          return;
        }

        if (!businessData) {
          setError('no_business');
          setLoading(false);
          return;
        }

        setBusinessId(businessData.id);

        // Get properties for this business
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id')
          .eq('business_id', businessData.id);

        if (propertiesError) {
          console.error('Error fetching properties:', propertiesError);
          setError('Failed to load properties');
          return;
        }

        if (!propertiesData || propertiesData.length === 0) {
          setOffers([]);
          setLoading(false);
          return;
        }

        const propertyIds = propertiesData.map(p => p.id);

        // Get offers for these properties
        const { data: offersData, error: offersError } = await supabase
          .from('offers')
          .select(`
            id,
            offer_amount,
            counter_amount,
            status,
            check_in_date,
            check_out_date,
            adults,
            children,
            updated_at,
            guest_user_id,
            property:properties(id, name)
          `)
          .in('property_id', propertyIds)
          .order('updated_at', { ascending: false });

        if (offersError) {
          console.error('Error fetching offers:', offersError);
          setError('Failed to load offers');
          return;
        }

        // Fetch guest profiles separately
        const guestIds = [...new Set((offersData || []).map(o => o.guest_user_id))];
        
        let profilesMap: Record<string, { first_name: string | null }> = {};
        
        if (guestIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, first_name')
            .in('user_id', guestIds);

          if (profilesData) {
            profilesMap = profilesData.reduce((acc, p) => {
              acc[p.user_id] = { first_name: p.first_name };
              return acc;
            }, {} as Record<string, { first_name: string | null }>);
          }
        }

        const enrichedOffers = (offersData || []).map(offer => ({
          ...offer,
          guest_profile: profilesMap[offer.guest_user_id] || null,
        })) as BusinessOffer[];

        setOffers(enrichedOffers);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchBusinessAndOffers();
    }
  }, [user]);

  const filteredOffers = activeTab === 'all' 
    ? offers 
    : offers.filter(o => o.status === activeTab);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/explore')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Offer Inbox</h1>
              <p className="text-muted-foreground">Manage incoming offers for your properties</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/messages')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error === 'no_business' ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No business registered</h3>
              <p className="text-muted-foreground mb-6">
                You need to claim a property to access the business dashboard.
              </p>
              <Button onClick={() => navigate('/explore')}>
                Find Your Property
              </Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              {statusTabs.map((tab) => {
                const count = tab.value === 'all' 
                  ? offers.length 
                  : offers.filter(o => o.status === tab.value).length;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    {tab.label}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {filteredOffers.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {activeTab === 'all' ? 'No offers yet' : `No ${activeTab} offers`}
                    </h3>
                    <p className="text-muted-foreground">
                      {activeTab === 'all' 
                        ? 'Offers will appear here when guests submit them.'
                        : `You don't have any offers with "${activeTab}" status.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredOffers.map((offer) => {
                    const status = statusConfig[offer.status] || statusConfig.submitted;
                    const checkIn = new Date(offer.check_in_date);
                    const checkOut = new Date(offer.check_out_date);
                    const guestName = offer.guest_profile?.first_name || 'Guest';

                    return (
                      <Card 
                        key={offer.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/business/offers/${offer.id}`)}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-foreground">
                                  {offer.property?.name || 'Unknown Property'}
                                </h3>
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </div>

                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-4 w-4" />
                                  <span>{guestName}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  <span>{format(checkIn, 'MMM d')} - {format(checkOut, 'MMM d')}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Users className="h-4 w-4" />
                                  <span>
                                    {offer.adults} adult{offer.adults !== 1 ? 's' : ''}
                                    {offer.children > 0 && `, ${offer.children} child${offer.children !== 1 ? 'ren' : ''}`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="h-4 w-4" />
                                  <span className="font-medium text-foreground">
                                    ${offer.offer_amount.toFixed(2)}/night
                                  </span>
                                  {offer.counter_amount && (
                                    <span className="text-primary ml-1">
                                      (Counter: ${offer.counter_amount.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground mt-2">
                                Updated: {format(new Date(offer.updated_at), 'MMM d, h:mm a')}
                              </p>
                            </div>

                            <div className="flex items-center">
                              <Button variant="ghost" size="sm">
                                View →
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
