import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, DollarSign, Clock, CheckCircle, Search, ChevronDown, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

type InvoiceStatus = 'pending' | 'paid' | 'void' | 'draft';

interface InvoiceWithBusiness {
  id: string;
  invoice_number: string;
  business_id: string;
  total_amount: number;
  gst_amount: number | null;
  period_start: string;
  period_end: string;
  issued_at: string;
  paid_at: string | null;
  status: string | null;
  business: {
    business_name: string;
    billing_email: string;
    country: string;
  } | null;
}

interface LineItem {
  id: string;
  invoice_id: string;
  offer_id: string;
  property_id: string;
  description: string;
  admin_fee_amount: number;
  check_in_date: string;
  check_out_date: string;
  booking_confirmed_at: string;
  property: {
    name: string;
    city: string;
  } | null;
}

function getStatusBadge(status: string | null) {
  const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    paid: { variant: 'default', label: 'Paid' },
    void: { variant: 'destructive', label: 'Void' },
    draft: { variant: 'outline', label: 'Draft' },
  };

  const config = statusMap[status || 'pending'] || statusMap.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
  }).format(amount);
}

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  
  // Default to last month
  const lastMonth = subMonths(new Date(), 1);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));

  // Fetch invoices with business info
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          business:businesses(business_name, billing_email, country)
        `)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data as InvoiceWithBusiness[];
    },
  });

  // Fetch line items for all invoices
  const { data: lineItems } = useQuery({
    queryKey: ['admin-invoice-line-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select(`
          *,
          property:properties(name, city)
        `);

      if (error) throw error;
      return data as LineItem[];
    },
  });

  // Calculate summary stats
  const stats = {
    total: invoices?.length || 0,
    pending: invoices?.filter(i => i.status === 'pending').length || 0,
    paid: invoices?.filter(i => i.status === 'paid').length || 0,
    totalRevenue: invoices?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0,
  };

  // Filter invoices
  const filteredInvoices = invoices?.filter(invoice => {
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesSearch = !searchQuery || 
      invoice.business?.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  // Get line items for a specific invoice
  const getLineItemsForInvoice = (invoiceId: string) => {
    return lineItems?.filter(item => item.invoice_id === invoiceId) || [];
  };

  const handleGenerateInvoices = async (dryRun: boolean = false) => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('generate-monthly-invoices', {
        body: {
          period_start: periodStart,
          period_end: periodEnd,
          dry_run: dryRun,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const { summary } = result;
      
      if (dryRun) {
        toast.info('Dry Run Results', {
          description: `Would create ${summary.invoices_created} invoices, ${summary.line_items_created} line items for ${summary.businesses_processed} businesses.`,
          duration: 5000,
        });
      } else {
        toast.success('Invoices Generated', {
          description: `Created ${summary.invoices_created} invoices, ${summary.line_items_created} line items. Updated ${summary.events_updated} events.`,
          duration: 5000,
        });
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['admin-invoice-line-items'] });
        setShowGenerateDialog(false);
      }

      if (summary.errors?.length > 0) {
        console.warn('Generation errors:', summary.errors);
        toast.warning(`${summary.errors.length} warnings occurred`, {
          description: 'Check console for details',
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate invoices';
      toast.error('Error', { description: message });
    } finally {
      setIsGenerating(false);
    }
  };

  if (invoicesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Billing Administration</h1>
          <p className="text-muted-foreground">Manage invoices for all businesses</p>
        </div>
        
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Invoices
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Monthly Invoices</DialogTitle>
              <DialogDescription>
                Create invoices from uninvoiced billable events within the selected period.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period-start">Period Start</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period-end">Period End</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                This will find all billable events confirmed between these dates that haven't been invoiced yet,
                group them by business, and create invoices.
              </p>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleGenerateInvoices(true)}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Preview (Dry Run)
              </Button>
              <Button
                onClick={() => handleGenerateInvoices(false)}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Generate Invoices
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.paid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by business or invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="void">Void</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No invoices found</p>
              {(statusFilter !== 'all' || searchQuery) && (
                <Button 
                  variant="link" 
                  onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const invoiceLineItems = getLineItemsForInvoice(invoice.id);
                    const subtotal = invoice.total_amount - (invoice.gst_amount || 0);
                    
                    return (
                      <AccordionItem key={invoice.id} value={invoice.id} className="border-0">
                        <TableRow className="hover:bg-muted/50">
                          <TableCell className="p-0">
                            <AccordionTrigger className="p-4 hover:no-underline">
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                            </AccordionTrigger>
                          </TableCell>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{invoice.business?.business_name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{invoice.business?.billing_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(invoice.period_start), 'MMM d')} - {format(new Date(invoice.period_end), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Issued: {format(new Date(invoice.issued_at), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.gst_amount || 0)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(invoice.total_amount)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={8} className="p-0 border-0">
                            <AccordionContent className="pb-0">
                              <div className="bg-muted/30 p-4 border-t">
                                <h4 className="text-sm font-medium mb-3">Line Items ({invoiceLineItems.length})</h4>
                                {invoiceLineItems.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No line items</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Property</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Stay Dates</TableHead>
                                        <TableHead>Confirmed</TableHead>
                                        <TableHead className="text-right">Fee</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoiceLineItems.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell>
                                            <div className="font-medium">{item.property?.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground">{item.property?.city}</div>
                                          </TableCell>
                                          <TableCell>{item.description}</TableCell>
                                          <TableCell>
                                            {format(new Date(item.check_in_date), 'MMM d')} - {format(new Date(item.check_out_date), 'MMM d, yyyy')}
                                          </TableCell>
                                          <TableCell>
                                            {format(new Date(item.booking_confirmed_at), 'MMM d, yyyy HH:mm')}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(item.admin_fee_amount)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </AccordionContent>
                          </TableCell>
                        </TableRow>
                      </AccordionItem>
                    );
                  })}
                </TableBody>
              </Table>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
