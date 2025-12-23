import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// This page now redirects to the unified onboarding flow
export default function BusinessClaim() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Preserve any query params for the onboarding flow
    const queryString = searchParams.toString();
    const redirectPath = queryString 
      ? `/business/onboarding?${queryString}` 
      : '/business/onboarding';
    navigate(redirectPath, { replace: true });
  }, [navigate, searchParams]);

  return null;
}
