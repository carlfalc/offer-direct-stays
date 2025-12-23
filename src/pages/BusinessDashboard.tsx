import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Users,
  DollarSign,
  Inbox,
  Building2,
  Settings,
  MapPin,
  FileText,
  CheckCircle2,
  MessageSquare,
  Plus,
} from 'lucide-react';
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

interface Property {
  id: string;
  name: string;
  city: string | null;
  country: string;
  active_offers: number;
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
  const { businesses, activeBusiness, activeBusinessId, setActiveBusinessId, loading: businessLoading } = useBusiness();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<BusinessOffer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/business/dashboard');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user || !activeBusinessId) {
        setOffers([]);
        setProperties([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get properties for this business
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id, name, city, country')
          .eq('business_id', activeBusinessId);

        if (propertiesError) {
          console.error('Error fetching properties:', propertiesError);
          setError('Failed to load properties');
          return;
        }

        const propertyIds = (propertiesData || []).map(p => p.id);

        // Get offers for these properties
        let offersData: any[] = [];
        if (propertyIds.length > 0) {
          const { data, error: offersError } = await supabase
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
              property_id,
              property:properties(id, name)
            `)
            .in('property_id', propertyIds)
            .order('updated_at', { ascending: false });

          if (offersError) {
            console.error('Error fetching offers:', offersError);
            setError('Failed to load offers');
            return;
          }
          offersData = data || [];
        }

        // Count active offers per property
        const offerCounts: Record<string, number> = {};
        offersData.forEach(offer => {
          if (['submitted', 'countered', 'accepted'].includes(offer.status)) {
            offerCounts[offer.property_id] = (offerCounts[offer.property_id] || 0) + 1;
          }
        });

        const enrichedProperties: Property[] = (propertiesData || []).map(p => ({
          ...p,
          active_offers: offerCounts[p.id] || 0,
        }));

        setProperties(enrichedProperties);

        // Fetch guest profiles
        const guestIds = [...new Set(offersData.map(o => o.guest_user_id))];
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

        const enrichedOffers = offersData.map(offer => ({
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

    if (user && !businessLoading) {
      fetchDashboardData();
    }
  }, [user, activeBusinessId, businessLoading]);

  const filteredOffers = activeTab === 'all'
    ? offers
    : offers.filter(o => o.status === activeTab);

  // Summary counts
  const submittedCount = offers.filter(o => o.status === 'submitted').length;
  const counteredCount = offers.filter(o => o.status === 'countered').length;
  const acceptedCount = offers.filter(o => o.status === 'accepted').length;
  const confirmedCount = offers.filter(o => o.status === 'confirmed').length;

  if (authLoading || businessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // No business registered
  if (businesses.length === 0) {
    return (
      <div className="min-h-full bg-background">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
              <h2 className="text-2xl font-bold text-foreground mb-3">No Business Registered</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                To access the business dashboard, you need to claim a property first. 
                This will create your business profile automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/explore')} size="lg">
                  <MapPin className="h-4 w-4 mr-2" />
                  Find Your Property
                </Button>
                <Button variant="outline" onClick={() => navigate('/business/settings')} size="lg">
                  <Settings className="h-4 w-4 mr-2" />
                  Business Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with Business Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Business Dashboard</h1>
            <p className="text-muted-foreground">Manage offers and properties</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Active Business:</span>
            <Select value={activeBusinessId || ''} onValueChange={setActiveBusinessId}>
              <SelectTrigger className="w-[220px] bg-background">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
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
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/50 rounded-lg">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Submitted</p>
                      <p className="text-2xl font-bold text-foreground">{submittedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/50 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Countered</p>
                      <p className="text-2xl font-bold text-foreground">{counteredCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accepted</p>
                      <p className="text-2xl font-bold text-foreground">{acceptedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Confirmed</p>
                      <p className="text-2xl font-bold text-foreground">{confirmedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Offers Section (2 columns) */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Inbox className="h-5 w-5" />
                      Offer Inbox
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="mb-4 flex-wrap h-auto gap-1">
                        {statusTabs.map((tab) => {
                          const count = tab.value === 'all'
                            ? offers.length
                            : offers.filter(o => o.status === tab.value).length;
                          return (
                            <TabsTrigger key={tab.value} value={tab.value} className="gap-2 text-xs sm:text-sm">
                              {tab.label}
                              <Badge variant="secondary" className="text-xs">
                                {count}
                              </Badge>
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>

                      <TabsContent value={activeTab} className="mt-0">
                        {filteredOffers.length === 0 ? (
                          <div className="py-12 text-center">
                            <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">
                              {offers.length === 0
                                ? 'No offers yet. Offers will appear here when guests submit them.'
                                : `No ${activeTab} offers at the moment.`}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {filteredOffers.map((offer) => {
                              const status = statusConfig[offer.status] || statusConfig.submitted;
                              const checkIn = new Date(offer.check_in_date);
                              const checkOut = new Date(offer.check_out_date);
                              const guestName = offer.guest_profile?.first_name || 'Guest';

                              return (
                                <div
                                  key={offer.id}
                                  className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                                  onClick={() => navigate(`/business/offers/${offer.id}`)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-foreground truncate">
                                          {offer.property?.name || 'Unknown Property'}
                                        </span>
                                        <Badge variant={status.variant} className="shrink-0">
                                          {status.label}
                                        </Badge>
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Users className="h-3.5 w-3.5" />
                                          {guestName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3.5 w-3.5" />
                                          {format(checkIn, 'MMM d')} - {format(checkOut, 'MMM d')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <DollarSign className="h-3.5 w-3.5" />
                                          ${offer.offer_amount}/night
                                        </span>
                                      </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="shrink-0">
                                      View →
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar (1 column) */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveTab('submitted')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Offers
                      {submittedCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {submittedCount}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate('/business/settings')}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Business Settings
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate('/explore')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Claim Properties
                    </Button>
                  </CardContent>
                </Card>

                {/* Properties Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Properties ({properties.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {properties.length === 0 ? (
                      <div className="py-6 text-center">
                        <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          No properties claimed yet
                        </p>
                        <Button size="sm" onClick={() => navigate('/explore')}>
                          Claim Property
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {properties.map((property) => (
                          <div
                            key={property.id}
                            className="p-3 border border-border rounded-lg"
                          >
                            <p className="font-medium text-foreground text-sm">
                              {property.name}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {property.city}, {property.country}
                            </p>
                            {property.active_offers > 0 && (
                              <Badge variant="secondary" className="mt-2 text-xs">
                                {property.active_offers} active offer{property.active_offers !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
