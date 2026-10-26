import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Wallet } from 'lucide-react';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';

/** Edit the accepted payment methods on a listing. Owners can change these any time. */
export default function PaymentMethodsCard({ listingId, initialMethods, initialNote }: {
  listingId: string; initialMethods: string[]; initialNote: string;
}) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<Set<string>>(new Set(initialMethods || []));
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);

  const toggle = (id: PaymentMethodId) =>
    setMethods((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('fs_listings')
      .update({ payment_methods: Array.from(methods), payment_note: note.trim() || null } as any)
      .eq('id', listingId);
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Payment methods saved' });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">How you receive payment</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Tick the ways guests can pay you the stay balance — change these any time. findastay only ever takes the commitment fee.</p>
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
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save payment methods</>}
        </Button>
      </div>
    </div>
  );
}
