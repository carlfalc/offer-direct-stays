import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Business {
  id: string;
  business_name: string;
  city: string | null;
  country: string;
}

interface BusinessContextType {
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string) => void;
  loading: boolean;
  refreshBusinesses: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

const STORAGE_KEY = 'active_business_id';

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = async () => {
    if (!user) {
      setBusinesses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name, city, country')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching businesses:', error);
        setBusinesses([]);
        return;
      }

      setBusinesses(data || []);

      // Auto-select first business if none selected or selected doesn't exist
      if (data && data.length > 0) {
        const storedId = localStorage.getItem(STORAGE_KEY);
        const validSelection = data.find(b => b.id === storedId);
        
        if (!validSelection) {
          setActiveBusinessIdState(data[0].id);
          localStorage.setItem(STORAGE_KEY, data[0].id);
        }
      } else {
        setActiveBusinessIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('Unexpected error fetching businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, [user]);

  const setActiveBusinessId = (id: string) => {
    setActiveBusinessIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeBusiness = businesses.find(b => b.id === activeBusinessId) || null;

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        activeBusiness,
        activeBusinessId,
        setActiveBusinessId,
        loading,
        refreshBusinesses: fetchBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
