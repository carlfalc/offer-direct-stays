import { format } from 'date-fns';
import { Invoice, FINDASTAY_SUPPLIER } from '@/types/invoice';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface InvoiceDocumentProps {
  invoice: Invoice;
  logoUrl?: string;
}

export function InvoiceDocument({ invoice, logoUrl }: InvoiceDocumentProps) {
  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    void: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="bg-background border border-border rounded-lg p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="FindAStay" className="h-12 w-auto" />
          ) : (
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold text-lg">F</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">INVOICE</h1>
            <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
          </div>
        </div>
        <Badge className={statusColors[invoice.status]}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </Badge>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Invoice Period
          </p>
          <p className="text-sm text-foreground">
            {format(new Date(invoice.period_start), 'd MMM yyyy')} – {format(new Date(invoice.period_end), 'd MMM yyyy')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Issue Date
          </p>
          <p className="text-sm text-foreground">
            {format(new Date(invoice.issued_at), 'd MMM yyyy')}
          </p>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Supplier and Customer */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            From
          </p>
          <div className="text-sm text-foreground space-y-1">
            <p className="font-medium">{invoice.supplier.name}</p>
            <p className="text-muted-foreground">{invoice.supplier.address}</p>
            <p className="text-muted-foreground">{invoice.supplier.email}</p>
            {invoice.supplier.tax_id && (
              <p className="text-muted-foreground">Tax ID: {invoice.supplier.tax_id}</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Bill To
          </p>
          <div className="text-sm text-foreground space-y-1">
            <p className="font-medium">{invoice.customer.business_name}</p>
            <p className="text-muted-foreground">{invoice.customer.address}</p>
            <p className="text-muted-foreground">{invoice.customer.billing_email}</p>
            {invoice.customer.nzbn && (
              <p className="text-muted-foreground">NZBN: {invoice.customer.nzbn}</p>
            )}
            {invoice.customer.tax_identifier && (
              <p className="text-muted-foreground">
                {invoice.customer.country === 'AU' ? 'ABN' : 'GST'}: {invoice.customer.tax_identifier}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Line Items Table */}
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Property
              </th>
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reference
              </th>
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </th>
              <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Qty
              </th>
              <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Unit Price
              </th>
              <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="py-3 text-foreground">
                  {format(new Date(item.confirmed_at), 'd MMM')}
                </td>
                <td className="py-3 text-foreground">
                  <div>
                    <p className="font-medium">{item.property_name}</p>
                    <p className="text-xs text-muted-foreground">{item.property_city}</p>
                  </div>
                </td>
                <td className="py-3 text-muted-foreground font-mono text-xs">
                  {item.offer_reference}
                </td>
                <td className="py-3 text-muted-foreground">{item.description}</td>
                <td className="py-3 text-foreground text-right">{item.quantity}</td>
                <td className="py-3 text-foreground text-right">
                  ${item.unit_price.toFixed(2)}
                </td>
                <td className="py-3 text-foreground text-right font-medium">
                  ${item.line_total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (0%)</span>
            <span className="text-foreground">${invoice.tax_total.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span className="text-foreground">Total Due ({invoice.currency})</span>
            <span className="text-foreground">${invoice.total_due.toFixed(2)}</span>
          </div>
          {invoice.status === 'paid' && invoice.paid_at && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Paid</span>
              <span>{format(new Date(invoice.paid_at), 'd MMM yyyy')}</span>
            </div>
          )}
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Notes */}
      <div className="text-xs text-muted-foreground space-y-1">
        {invoice.notes.map((note, index) => (
          <p key={index}>{note}</p>
        ))}
        <p className="mt-3">
          Questions? Contact us at {FINDASTAY_SUPPLIER.email}
        </p>
      </div>
    </div>
  );
}
