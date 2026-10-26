import BusinessOnboard from '@/components/business/BusinessOnboard';

export default function BusinessClaim() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Claim your property</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search your business below and take control of your pricing and offers. Can’t find it? Create it.</p>
      </div>
      <BusinessOnboard />
    </div>
  );
}
