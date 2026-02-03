import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  Building2,
  Settings,
  MapPin,
  FileText,
  CheckCircle2,
  MessageSquare,
  Plus,
  XCircle,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  room_id: string | null;
  property: {
    id: string;
    name: string;
  } | null;
  room: {
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

export default function BusinessDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { businesses, activeBusiness, activeBusinessId, setActiveBusinessId, loading: businessLoading } = useBusiness();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<BusinessOffer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/business/dashboard');
    }
  }, [user, authLoading, navigate]);

  const fetchDashboardData = async () => {
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
            room_id,
            property_id,
            property:properties(id, name),
            room:rooms(id, name)
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
  };

  useEffect(() => {
    if (user && !businessLoading) {
      fetchDashboardData();
    }
  }, [user, activeBusinessId, businessLoading]);

  const handleOfferAction = async (offerId: string, action: 'accepted' | 'declined', e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(offerId);
    
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: action, updated_at: new Date().toISOString() })
        .eq('id', offerId);

      if (error) {
        console.error('Error updating offer:', error);
        toast.error(`Failed to ${action === 'accepted' ? 'accept' : 'decline'} offer`);
        return;
      }

      toast.success(`Offer ${action === 'accepted' ? 'accepted' : 'declined'} successfully`);
      
      // Update local state
      setOffers(prev => prev.map(o => 
        o.id === offerId ? { ...o, status: action } : o
      ));
    } catch (err) {
      console.error('Error:', err);
      toast.error('An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCounter = (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/business/offers/${offerId}?action=counter`);
  };

  // Summary counts
  const receivedCount = offers.filter(o => o.status === 'submitted' || o.status === 'pending').length;
  const counteredCount = offers.filter(o => o.status === 'countered').length;
  const acceptedCount = offers.filter(o => o.status === 'accepted').length;
  const confirmedCount = offers.filter(o => o.status === 'confirmed').length;
  const declinedCount = offers.filter(o => o.status === 'declined').length;

  // Recent offers (last 10, excluding confirmed/cancelled)
  const recentOffers = offers
    .filter(o => ['submitted', 'pending', 'countered', 'accepted'].includes(o.status))
    .slice(0, 10);

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
                To access the business dashboard, you need to register your business and claim a property.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/business/settings')} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Business
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
      <div className="max-w-7xl mx-auto px-4 py-8">
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => (
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/50 rounded-lg">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Offers received</p>
                      <p className="text-2xl font-bold text-foreground">{receivedCount}</p>
                      <p className="text-xs text-muted-foreground">Needs response</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Countered</p>
                      <p className="text-2xl font-bold text-foreground">{counteredCount}</p>
                      <p className="text-xs text-muted-foreground">Awaiting guest</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accepted</p>
                      <p className="text-2xl font-bold text-foreground">{acceptedCount}</p>
                      <p className="text-xs text-muted-foreground">Guest payment pending</p>
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
                      <p className="text-xs text-muted-foreground">Ready for check‑in</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Declined</p>
                      <p className="text-2xl font-bold text-foreground">{declinedCount}</p>
                      <p className="text-xs text-muted-foreground">No action needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
              {/* Recent Offers Section (2 columns) */}
              <div>
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Recent Offers
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/business/offers')}>
                        View all offers
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    <CardDescription>
                      Review new offers quickly and respond with one click.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentOffers.length === 0 ? (
                      <div className="py-12 text-center">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium mb-2">
                          No active offers yet
                        </p>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          When guests submit offers for your properties, they'll appear here for you to review and respond.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentOffers.map((offer) => {
                          const checkIn = new Date(offer.check_in_date);
                          const checkOut = new Date(offer.check_out_date);
                          const guestName = offer.guest_profile?.first_name || 'Guest';
                          const roomName = offer.room?.name || 'Any room';
                          const isActionable = offer.status === 'submitted' || offer.status === 'pending';
                          const isLoading = actionLoading === offer.id;

                          return (
                            <div
                              key={offer.id}
                              className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                              onClick={() => navigate(`/business/offers/${offer.id}`)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium text-foreground">
                                      {guestName}
                                    </span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm text-muted-foreground">
                                      {roomName}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                                      <DollarSign className="h-4 w-4" />
                                      ${offer.offer_amount}/night
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                      <Calendar className="h-4 w-4" />
                                      {format(checkIn, 'MMM d')} – {format(checkOut, 'MMM d')}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                      <Users className="h-4 w-4" />
                                      {offer.adults + offer.children} guests
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Inline Actions */}
                                {isActionable ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-950"
                                      onClick={(e) => handleOfferAction(offer.id, 'accepted', e)}
                                      disabled={isLoading}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 dark:border-orange-800 dark:hover:bg-orange-950"
                                      onClick={(e) => handleCounter(offer.id, e)}
                                      disabled={isLoading}
                                    >
                                      <MessageSquare className="h-4 w-4 mr-1" />
                                      Counter
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30"
                                      onClick={(e) => handleOfferAction(offer.id, 'declined', e)}
                                      disabled={isLoading}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Decline
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge 
                                    variant={
                                      offer.status === 'accepted' ? 'default' :
                                      offer.status === 'countered' ? 'outline' :
                                      offer.status === 'declined' ? 'destructive' : 'secondary'
                                    }
                                    className="shrink-0"
                                  >
                                    {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar (1 column) */}
              <div className="space-y-6 lg:sticky lg:top-20 h-fit">
                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate('/business/offers')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Offers
                      {receivedCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {receivedCount}
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
                      onClick={() => navigate('/business/claim')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Claim Property
                    </Button>
                  </CardContent>
                </Card>

                {/* Properties Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Your Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {properties.length === 0 ? (
                      <div className="py-6 text-center">
                        <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          No properties claimed yet
                        </p>
                        <Button size="sm" onClick={() => navigate('/business/claim')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Claim Property
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {properties.map((property) => (
                          <div
                            key={property.id}
                            className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/business/properties/${property.id}`)}
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
