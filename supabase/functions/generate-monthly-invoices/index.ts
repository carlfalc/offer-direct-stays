import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICES] ${step}${detailsStr}`);
};

interface GenerateRequest {
  period_start: string;
  period_end: string;
  dry_run?: boolean;
}

interface InvoiceSummary {
  invoices_created: number;
  invoices_reused: number;
  line_items_created: number;
  events_updated: number;
  businesses_processed: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is admin
    const { data: isAdminResult } = await supabaseClient.rpc('is_admin');
    if (!isAdminResult) {
      throw new Error("Access denied: Admin privileges required");
    }
    logStep("Admin access verified");

    const { period_start, period_end, dry_run = false }: GenerateRequest = await req.json();
    if (!period_start || !period_end) {
      throw new Error("period_start and period_end are required");
    }
    logStep("Processing request", { period_start, period_end, dry_run });

    const summary: InvoiceSummary = {
      invoices_created: 0,
      invoices_reused: 0,
      line_items_created: 0,
      events_updated: 0,
      businesses_processed: 0,
      errors: [],
    };

    // Fetch uninvoiced billable events within period
    const { data: billableEvents, error: eventsError } = await supabaseClient
      .from("billable_events")
      .select(`
        id,
        business_id,
        property_id,
        offer_id,
        booking_confirmed_at,
        check_in_date,
        check_out_date,
        admin_fee_amount,
        currency,
        description
      `)
      .is("invoiced_invoice_id", null)
      .gte("booking_confirmed_at", period_start)
      .lte("booking_confirmed_at", period_end + "T23:59:59.999Z");

    if (eventsError) {
      throw new Error(`Error fetching billable events: ${eventsError.message}`);
    }

    logStep("Found billable events", { count: billableEvents?.length || 0 });

    if (!billableEvents || billableEvents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dry_run,
        summary,
        message: "No uninvoiced billable events found for this period"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Group events by business_id
    const eventsByBusiness = billableEvents.reduce((acc, event) => {
      const bizId = event.business_id;
      if (!acc[bizId]) {
        acc[bizId] = [];
      }
      acc[bizId].push(event);
      return acc;
    }, {} as Record<string, typeof billableEvents>);

    logStep("Grouped by business", { businessCount: Object.keys(eventsByBusiness).length });

    // Process each business
    for (const [businessId, events] of Object.entries(eventsByBusiness)) {
      summary.businesses_processed++;
      
      try {
        // Get the currency from the first event (assuming all events for a business have same currency)
        const currency = events[0].currency || 'NZD';
        
        // Calculate subtotal
        const subtotal = events.reduce((sum, e) => sum + (e.admin_fee_amount || 0), 0);
        
        // Generate invoice number
        const periodEndDate = new Date(period_end);
        const year = periodEndDate.getFullYear();
        const month = String(periodEndDate.getMonth() + 1).padStart(2, '0');
        const shortBizId = businessId.slice(0, 8).toUpperCase();
        const invoiceNumber = `INV-${year}${month}-${shortBizId}`;

        logStep("Processing business", { 
          businessId, 
          eventCount: events.length, 
          subtotal,
          invoiceNumber 
        });

        // Check if invoice already exists for this business+period (idempotency)
        const { data: existingInvoice } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("business_id", businessId)
          .eq("period_start", period_start)
          .eq("period_end", period_end)
          .maybeSingle();

        let invoiceId: string;

        if (existingInvoice) {
          // Reuse existing invoice
          invoiceId = existingInvoice.id;
          summary.invoices_reused++;
          logStep("Reusing existing invoice", { invoiceId, invoiceNumber });
        } else {
          if (dry_run) {
            logStep("DRY RUN: Would create invoice", { invoiceNumber, subtotal });
            summary.invoices_created++;
            continue; // Skip actual creation in dry run
          }

          // Create new invoice
          const { data: newInvoice, error: invoiceError } = await supabaseClient
            .from("invoices")
            .insert({
              business_id: businessId,
              invoice_number: invoiceNumber,
              period_start,
              period_end,
              status: "pending",
              total_amount: subtotal,
              gst_amount: 0, // 0% GST for now
            })
            .select("id")
            .single();

          if (invoiceError) {
            summary.errors.push(`Failed to create invoice for business ${businessId}: ${invoiceError.message}`);
            logStep("Error creating invoice", { businessId, error: invoiceError.message });
            continue;
          }

          invoiceId = newInvoice.id;
          summary.invoices_created++;
          logStep("Created invoice", { invoiceId, invoiceNumber });
        }

        if (dry_run) {
          logStep("DRY RUN: Would create line items and update events", { eventCount: events.length });
          summary.line_items_created += events.length;
          summary.events_updated += events.length;
          continue;
        }

        // Create line items for each event
        for (const event of events) {
          // Check if line item already exists for this offer (idempotency)
          const { data: existingLineItem } = await supabaseClient
            .from("invoice_line_items")
            .select("id")
            .eq("invoice_id", invoiceId)
            .eq("offer_id", event.offer_id)
            .maybeSingle();

          if (!existingLineItem) {
            const { error: lineItemError } = await supabaseClient
              .from("invoice_line_items")
              .insert({
                invoice_id: invoiceId,
                offer_id: event.offer_id,
                property_id: event.property_id,
                description: event.description || "Booking Confirmation Fee",
                admin_fee_amount: event.admin_fee_amount,
                check_in_date: event.check_in_date,
                check_out_date: event.check_out_date,
                booking_confirmed_at: event.booking_confirmed_at,
              });

            if (lineItemError) {
              summary.errors.push(`Failed to create line item for event ${event.id}: ${lineItemError.message}`);
              logStep("Error creating line item", { eventId: event.id, error: lineItemError.message });
              continue;
            }

            summary.line_items_created++;
          }

          // Update billable event with invoice reference
          const { error: updateError } = await supabaseClient
            .from("billable_events")
            .update({ invoiced_invoice_id: invoiceId })
            .eq("id", event.id);

          if (updateError) {
            summary.errors.push(`Failed to update billable event ${event.id}: ${updateError.message}`);
            logStep("Error updating billable event", { eventId: event.id, error: updateError.message });
          } else {
            summary.events_updated++;
          }
        }

        logStep("Completed business", { businessId, invoiceId });

      } catch (bizError) {
        const errMsg = bizError instanceof Error ? bizError.message : String(bizError);
        summary.errors.push(`Error processing business ${businessId}: ${errMsg}`);
        logStep("Error processing business", { businessId, error: errMsg });
      }
    }

    logStep("Generation complete", summary);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      summary,
      message: dry_run 
        ? `Dry run complete. Would create ${summary.invoices_created} invoices.`
        : `Generated ${summary.invoices_created} invoices, ${summary.line_items_created} line items.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
