import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-BCF-PAYMENT] ${step}${detailsStr}`);
};

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { session_id, offer_id } = await req.json();
    if (!session_id || !offer_id) throw new Error("session_id and offer_id are required");
    logStep("Processing verification", { session_id, offer_id });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Retrieved Stripe session", { 
      status: session.payment_status,
      metadata: session.metadata 
    });

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Verify the session belongs to this offer
    if (session.metadata?.offer_id !== offer_id) {
      throw new Error("Session does not match offer");
    }

    // Update the offer with payment details and fee settlement info
    const bcfAmount = parseFloat(session.metadata?.bcf_amount || "0");
    const bcfCurrency = session.metadata?.bcf_currency || "NZD";
    
    const { error: updateError } = await supabaseClient
      .from("offers")
      .update({
        bcf_payment_status: "paid",
        bcf_stripe_payment_id: session.payment_intent as string,
        bcf_paid_at: new Date().toISOString(),
        bcf_amount: bcfAmount,
        bcf_currency: bcfCurrency,
        status: "confirmed",
        // New fee settlement fields
        fee_amount: bcfAmount,
        fee_currency: bcfCurrency,
        fee_settled_via: "guest_admin_fee",
        fee_payment_status: "paid",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", offer_id)
      .eq("guest_user_id", user.id);

    if (updateError) throw new Error(`Error updating offer: ${updateError.message}`);
    logStep("Offer updated to confirmed", { offer_id });

    // Fetch offer with property and business details (including billing preference)
    const { data: offer } = await supabaseClient
      .from("offers")
      .select(`
        guest_user_id, 
        property_id, 
        check_in_date,
        check_out_date,
        confirmed_at,
        properties:property_id(
          business_id, 
          businesses:business_id(user_id, payment_collection_method)
        )
      `)
      .eq("id", offer_id)
      .single();

    const businessId = (offer?.properties as any)?.business_id;
    const businessUserId = (offer?.properties as any)?.businesses?.user_id;
    const paymentCollectionMethod = (offer?.properties as any)?.businesses?.payment_collection_method || 'pay_at_property';
    const guestUserId = offer?.guest_user_id;
    const propertyId = offer?.property_id;
    const checkInDate = offer?.check_in_date;
    const checkOutDate = offer?.check_out_date;
    const confirmedAt = offer?.confirmed_at || new Date().toISOString();

    logStep("Business billing preference", { 
      business_id: businessId, 
      payment_collection_method: paymentCollectionMethod 
    });

    // Only create billable event if billing model is invoice_monthly (business_invoice)
    // Do NOT create billable event for pay_at_property (guest pays BCF directly)
    if (businessId && paymentCollectionMethod === 'business_invoice') {
      // Check if billable event already exists for this offer (idempotency)
      const { data: existingEvent } = await supabaseClient
        .from("billable_events")
        .select("id")
        .eq("offer_id", offer_id)
        .maybeSingle();

      if (!existingEvent) {
        const { error: billableError } = await supabaseClient.from("billable_events").insert({
          business_id: businessId,
          offer_id: offer_id,
          property_id: propertyId,
          booking_confirmed_at: confirmedAt,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          admin_fee_amount: bcfAmount,
          amount: bcfAmount, // Keep for backward compatibility
          currency: bcfCurrency,
          billing_model: 'invoice_monthly',
          invoiced_invoice_id: null,
          description: `Booking Confirmation Fee`,
        });

        if (billableError) {
          logStep("Warning: Could not create billable event", { error: billableError.message });
        } else {
          logStep("Billable event created for invoice_monthly business", { 
            business_id: businessId,
            offer_id: offer_id,
            amount: bcfAmount,
            currency: bcfCurrency
          });
        }
      } else {
        logStep("Billable event already exists, skipping", { offer_id });
      }
    } else if (businessId) {
      logStep("Skipping billable event - pay_at_property model", { business_id: businessId });
    }

    // Create or update conversation for two-way chat
    // First check if conversation exists
    const { data: existingConv } = await supabaseClient
      .from("conversations")
      .select("id, business_id, business_user_id")
      .eq("offer_id", offer_id)
      .maybeSingle();

    const conversationData = {
      is_unlocked: true,
      business_id: businessId,
      business_user_id: businessUserId,
      guest_user_id: guestUserId,
      last_message_at: new Date().toISOString()
    };

    let conversationId: string | null = null;
    const systemMessage = "Booking confirmed ✅ You can now message the property directly here.";

    if (existingConv) {
      conversationId = existingConv.id;
      // Update existing conversation - fill in any missing fields
      const updateData: any = { 
        is_unlocked: true,
        last_message_at: new Date().toISOString()
      };
      
      // Only update business fields if they're not already set
      if (!existingConv.business_id && businessId) {
        updateData.business_id = businessId;
      }
      if (!existingConv.business_user_id && businessUserId) {
        updateData.business_user_id = businessUserId;
      }
      
      const { error: convError } = await supabaseClient
        .from("conversations")
        .update(updateData)
        .eq("offer_id", offer_id);
      
      if (convError) {
        logStep("Warning: Could not unlock conversation", { error: convError.message });
      } else {
        logStep("Conversation unlocked", { 
          id: existingConv.id, 
          business_id: businessId, 
          business_user_id: businessUserId 
        });
      }
    } else {
      // Create new conversation with all fields
      const { data: newConv, error: convError } = await supabaseClient
        .from("conversations")
        .insert({
          offer_id: offer_id,
          guest_user_id: guestUserId,
          business_id: businessId,
          business_user_id: businessUserId,
          is_unlocked: true,
          last_message_at: new Date().toISOString()
        })
        .select("id")
        .single();
      
      if (convError) {
        logStep("Warning: Could not create conversation", { error: convError.message });
      } else {
        conversationId = newConv?.id || null;
        logStep("Conversation created and unlocked", {
          offer_id,
          conversation_id: conversationId,
          guest_user_id: guestUserId,
          business_id: businessId,
          business_user_id: businessUserId
        });
      }
    }

    // Insert system message if conversation exists and no system message yet
    if (conversationId && guestUserId) {
      // Check if system message already exists
      const { data: existingMsg } = await supabaseClient
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("content", systemMessage)
        .maybeSingle();

      if (!existingMsg) {
        const { error: msgError } = await supabaseClient
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_user_id: guestUserId,
            content: systemMessage,
            is_read: false
          });

        if (msgError) {
          logStep("Warning: Could not insert system message", { error: msgError.message });
        } else {
          logStep("System message inserted", { conversation_id: conversationId });
        }
      } else {
        logStep("System message already exists", { conversation_id: conversationId });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      status: "confirmed",
      message: "Booking commitment fee paid successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
