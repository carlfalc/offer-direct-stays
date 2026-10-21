import ClaimPropertySearch from '@/components/business/ClaimPropertySearch';

// Business onboarding is now a single step: find and claim your business by name.
// (The old multi-step form built on the legacy properties/businesses tables has
// been retired in favour of the LiteAPI-backed claim search.)
export default function BusinessOnboarding() {
  return (
    <ClaimPropertySearch
      heading="Claim my business"
      subtitle="Start typing your business name and pick it from the list to claim it. Once it's yours, you can set your prices and start receiving offers."
    />
  );
}
