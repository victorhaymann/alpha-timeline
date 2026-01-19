import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

async function sendPmNotification(
  supabase: any,
  agreement: { id: string; project_id: string; client_name: string; client_email: string },
  eventType: 'signed' | 'declined'
) {
  try {
    // Fetch project details including PM email
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, pm_email, pm_name, owner_id")
      .eq("id", agreement.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found for notification:", projectError);
      return;
    }

    // Get PM email - fallback to owner's profile email if pm_email is not set
    let pmEmail = (project as any).pm_email;
    
    if (!pmEmail && (project as any).owner_id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", (project as any).owner_id)
        .single();
      
      pmEmail = (ownerProfile as any)?.email;
    }

    if (!pmEmail) {
      console.log("No PM email configured for project:", agreement.project_id);
      return;
    }

    const projectName = (project as any).name || 'Unknown Project';

    const isDeclined = eventType === 'declined';
    const statusEmoji = isDeclined ? '❌' : '✅';
    const statusText = isDeclined ? 'Declined' : 'Signed';
    const statusColor = isDeclined ? '#ef4444' : '#22c55e';
    const headerGradient = isDeclined 
      ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
      : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';

    const eventTime = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const emailResponse = await resend.emails.send({
      from: "The New Face <onboarding@resend.dev>",
      to: [pmEmail],
      subject: `${statusEmoji} Rights Agreement ${statusText} - ${agreement.client_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: ${headerGradient}; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Rights Agreement ${statusText}
              </h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
              <p style="color: #3f3f46; font-size: 16px; margin: 0 0 24px 0;">
                ${isDeclined 
                  ? `<strong>${agreement.client_name}</strong> has declined the rights agreement for <strong>${projectName}</strong>.`
                  : `Great news! <strong>${agreement.client_name}</strong> has signed the rights agreement for <strong>${projectName}</strong>.`
                }
              </p>
              
              <!-- Agreement details card -->
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Status</td>
                    <td style="color: ${statusColor}; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${statusText}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Client</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${agreement.client_name}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Email</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${agreement.client_email}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Project</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${projectName}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">${statusText} At</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${eventTime}</td>
                  </tr>
                </table>
              </div>
              
              ${!isDeclined ? `
              <p style="color: #3f3f46; font-size: 14px; margin: 0 0 16px 0;">
                The signed copy has been automatically saved to the project. You can download it from the Rights tab in the project details.
              </p>
              ` : `
              <p style="color: #3f3f46; font-size: 14px; margin: 0 0 16px 0;">
                You may want to reach out to the client to discuss the agreement terms or create a revised version.
              </p>
              `}
              
              <p style="color: #71717a; font-size: 14px; margin: 0; text-align: center;">
                You're receiving this because you're the PM for this project.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f4f4f5; padding: 20px; text-align: center;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                Powered by The New Face
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Failed to send PM notification email:", emailResponse.error);
    } else {
      console.log("PM notification email sent successfully:", emailResponse.data?.id);
    }
  } catch (error) {
    console.error("Error sending PM notification:", error);
  }
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
      .select('id, project_id, client_name, client_email')
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
    let shouldNotifyPm = false;
    let notificationEventType: 'signed' | 'declined' = 'signed';

    switch (payload.event_type) {
      case 'document_viewed':
        newStatus = 'viewed';
        console.log('Document viewed');
        break;

      case 'document_completed':
        newStatus = 'signed';
        shouldNotifyPm = true;
        notificationEventType = 'signed';
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
        shouldNotifyPm = true;
        notificationEventType = 'declined';
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

    // Send PM notification for signed/declined events
    if (shouldNotifyPm) {
      await sendPmNotification(supabase, agreement, notificationEventType);
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
