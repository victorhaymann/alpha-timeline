import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPmUploadRequest {
  projectId: string;
  fileName: string;
  category: string;
  shareToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, fileName, category, shareToken }: NotifyPmUploadRequest = await req.json();

    // Validate required fields
    if (!projectId || !fileName || !category || !shareToken) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify share token is valid and active
    const { data: share, error: shareError } = await supabase
      .from("project_shares")
      .select("id, project_id, is_active")
      .eq("token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (shareError || !share) {
      console.error("Invalid share token:", shareError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired share token" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify project ID matches share
    if (share.project_id !== projectId) {
      return new Response(
        JSON.stringify({ error: "Project mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch project details including PM email
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, pm_email, pm_name, owner_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get PM email - fallback to owner's profile email if pm_email is not set
    let pmEmail = project.pm_email;
    
    if (!pmEmail && project.owner_id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", project.owner_id)
        .single();
      
      pmEmail = ownerProfile?.email;
    }

    if (!pmEmail) {
      console.log("No PM email configured for project:", projectId);
      return new Response(
        JSON.stringify({ message: "No PM email configured, skipping notification" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format category name for display
    const categoryLabels: Record<string, string> = {
      brandbook: "Brandbook",
      logos: "Logos",
      fonts: "Fonts",
      "3d_assets": "3D Assets",
      client_brief: "Client Brief",
      artistic_direction: "Artistic Direction",
    };
    const categoryLabel = categoryLabels[category] || category;

    // Format timestamp
    const uploadTime = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Build project URL (assuming production domain)
    const projectUrl = `${supabaseUrl.replace(".supabase.co", "")}/projects/${projectId}`;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "The New Face <onboarding@resend.dev>",
      to: [pmEmail],
      subject: `📁 New file uploaded to ${project.name}`,
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
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                New File Upload
              </h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
              <p style="color: #3f3f46; font-size: 16px; margin: 0 0 24px 0;">
                A client has uploaded a new file to <strong>${project.name}</strong>.
              </p>
              
              <!-- File details card -->
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">File Name</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${fileName}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Category</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${categoryLabel}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; font-size: 14px; padding: 8px 0;">Uploaded</td>
                    <td style="color: #18181b; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${uploadTime}</td>
                  </tr>
                </table>
              </div>
              
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

    // Check for email sending errors
    if (emailResponse.error) {
      console.error("Failed to send email:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to send notification email", details: emailResponse.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", emailResponse.data);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-pm-upload function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
