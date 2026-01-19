import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignWellWebhookPayload {
  event_type: string;
  document: {
    id: string;
    name: string;
    status: string;
    completed_pdf?: string;
    recipients?: Array<{
      id: string;
      name: string;
      email: string;
      status: string;
    }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json() as SignWellWebhookPayload;
    
    console.log('SignWell webhook received:', payload.event_type, payload.document?.id);

    const signwellDocumentId = payload.document?.id;
    if (!signwellDocumentId) {
      console.error('No document ID in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing document ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the agreement by SignWell document ID
    const { data: agreement, error: findError } = await supabase
      .from('rights_agreements')
      .select('id, project_id')
      .eq('signwell_document_id', signwellDocumentId)
      .maybeSingle();

    if (findError) {
      console.error('Database error finding agreement:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agreement) {
      console.warn('No agreement found for SignWell document:', signwellDocumentId);
      return new Response(
        JSON.stringify({ message: 'Agreement not found, ignoring webhook' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found agreement:', agreement.id);

    let newStatus: string | null = null;
    let signedDocumentPath: string | null = null;

    switch (payload.event_type) {
      case 'document_viewed':
        newStatus = 'viewed';
        console.log('Document viewed');
        break;

      case 'document_completed':
        newStatus = 'signed';
        console.log('Document completed/signed');

        // Download and store the signed PDF if available
        if (payload.document.completed_pdf) {
          try {
            console.log('Downloading signed PDF from:', payload.document.completed_pdf);
            
            const pdfResponse = await fetch(payload.document.completed_pdf);
            if (pdfResponse.ok) {
              const pdfBuffer = await pdfResponse.arrayBuffer();
              const pdfBytes = new Uint8Array(pdfBuffer);
              
              const fileName = `${agreement.id}/signed-agreement.pdf`;
              
              const { error: uploadError } = await supabase.storage
                .from('rights-agreements')
                .upload(fileName, pdfBytes, {
                  contentType: 'application/pdf',
                  upsert: true,
                });

              if (uploadError) {
                console.error('Failed to upload signed PDF:', uploadError);
              } else {
                signedDocumentPath = fileName;
                console.log('Signed PDF stored:', fileName);
              }
            } else {
              console.error('Failed to download signed PDF:', pdfResponse.status);
            }
          } catch (downloadError) {
            console.error('Error downloading signed PDF:', downloadError);
          }
        }
        break;

      case 'document_declined':
        newStatus = 'declined';
        console.log('Document declined');
        break;

      default:
        console.log('Unhandled event type:', payload.event_type);
        return new Response(
          JSON.stringify({ message: 'Event type not handled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update the agreement status
    if (newStatus) {
      const updateData: Record<string, string | null> = { status: newStatus };
      if (signedDocumentPath) {
        updateData.signed_document_path = signedDocumentPath;
      }

      const { error: updateError } = await supabase
        .from('rights_agreements')
        .update(updateData)
        .eq('id', agreement.id);

      if (updateError) {
        console.error('Failed to update agreement status:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update agreement' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Agreement status updated to:', newStatus);
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
