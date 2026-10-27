import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Wallet } from 'lucide-react';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';

type PaymentTerms = 'on_arrival' | 'days_before' | 'upfront';

/** Edit payment settings on a listing — when the balance is due, the lead days,
 *  and the accepted payment methods. Owners can change these any time. */
export default function PaymentMethodsCard({ listingId, initialMethods, initialNote, initialTerms = 'on_arrival', initialLeadDays = 10, hideHeader = false }: {
  listingId: string; initialMethods: string[]; initialNote: string;
  initialTerms?: PaymentTerms; initialLeadDays?: number; hideHeader?: boolean;
}) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<Set<string>>(new Set(initialMethods || []));
  const [note, setNote] = useState(initialNote || '');
  const [terms, setTerms] = useState<PaymentTerms>(initialTerms);
  const [leadDays, setLeadDays] = useState(initialLeadDays || 10);
  const [saving, setSaving] = useState(false);

  const toggle = (id: PaymentMethodId) =>
    setMethods((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('fs_listings')
      .update({
        payment_methods: Array.from(methods),
        payment_note: note.trim() || null,
        payment_terms: terms,
        payment_lead_days: terms === 'days_before' ? leadDays : null,
      } as any)
      .eq('id', listingId);
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Payment settings saved' });
  };

  return (
    <div className={hideHeader ? '' : 'rounded-xl border border-border bg-card p-4 sm:p-5'}>
      {!hideHeader && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Payment settings</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Change these any time. findastay only ever takes the commitment fee — the balance is paid directly to you.</p>
        </>
      )}

      {/* When is the balance due */}
      <p className="mb-1.5 text-sm font-semibold text-foreground">When is the balance due? <span className="font-normal text-muted-foreground">(after the commitment fee)</span></p>
      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input type="radio" name="pt" checked={terms === 'on_arrival'} onChange={() => setTerms('on_arrival')} className="h-4 w-4 flex-none" /> On arrival
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input type="radio" name="pt" checked={terms === 'days_before'} onChange={() => setTerms('days_before')} className="h-4 w-4 flex-none" /> A set number of days before arrival:
          <input type="number" min={1} max={120} value={leadDays} onFocus={() => setTerms('days_before')} onChange={(e) => setLeadDays(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} className="w-16 rounded-md border border-border px-2 py-1 text-sm" />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input type="radio" name="pt" checked={terms === 'upfront'} onChange={() => setTerms('upfront')} className="h-4 w-4 flex-none" /> Upfront when the offer is accepted
        </label>
      </div>

      <p className="mb-2 mt-4 text-sm font-semibold text-foreground">How guests can pay you</p>
      <div className="space-y-2">
        {PAYMENT_METHODS.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:border-primary/40">
            <input type="checkbox" checked={methods.has(m.id)} onChange={() => toggle(m.id)} className="mt-0.5 h-4 w-4 flex-none" />
            <span className="min-w-0"><span className="text-sm font-medium text-foreground">{m.label}</span><span className="block text-xs text-muted-foreground">{m.hint}</span></span>
          </label>
        ))}
      </div>
      {methods.has('payment_link') && (
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste your payment link or any payment notes for guests" className="mt-2 min-h-[56px]" />
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save payment settings</>}
        </Button>
      </div>
    </div>
  );
}
