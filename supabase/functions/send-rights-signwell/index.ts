import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNWELL_API_URL = 'https://www.signwell.com/api/v1';

interface UsageSelection {
  category: string;
  is_paid: boolean;
  geographies: string[];
  period_start: string;
  period_end: string | null;
}

const CATEGORY_MAP: Record<string, string> = {
  digital: 'DIGITAL',
  paid_media: 'PAID_MEDIA',
  pos_retail: 'POS',
  print: 'PRINT',
  ooh: 'OOH',
  tv: 'TV',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPeriod(start: string, end: string | null): string {
  const startDate = formatDate(start);
  if (!end) return `${startDate} - Perpetual`;
  return `${startDate} - ${formatDate(end)}`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateAgreementHtml(data: Record<string, string>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Content Usage Rights Agreement</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 30px; text-transform: uppercase; }
    h2 { font-size: 12pt; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #000; padding-bottom: 4px; }
    h3 { font-size: 11pt; margin-top: 16px; margin-bottom: 8px; }
    .party-block { margin: 16px 0; padding-left: 20px; }
    .party-block p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .signature-table { margin-top: 40px; }
    .signature-table td { width: 50%; vertical-align: top; padding: 12px; }
    .signature-line { border-bottom: 1px solid #000; height: 40px; margin: 8px 0; }
    .footer { text-align: center; font-size: 9pt; color: #666; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; }
    ol { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <h1>Video Content Usage Rights Agreement</h1>

  <h2>1. Parties</h2>
  <p>This Video Content Usage Rights Agreement (the "Agreement") is entered into by and between:</p>
  
  <div class="party-block">
    <p><strong>Licensor:</strong> The New Face</p>
    <p><strong>Address:</strong> 23 Rue des Petits Hotels, 75010, Paris, France</p>
  </div>
  
  <p>and</p>
  
  <div class="party-block">
    <p><strong>Licensee (Client):</strong> ${escapeHtml(data.CLIENT_NAME)}</p>
    <p><strong>Contact Person:</strong> ${escapeHtml(data.CLIENT_CONTACT_NAME)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.CLIENT_EMAIL)}</p>
  </div>
  
  <p>The Licensor and Licensee may each be referred to as a "Party" and collectively as the "Parties."</p>

  <h2>2. Content Description</h2>
  <p><strong>Project Name:</strong> ${escapeHtml(data.PROJECT_NAME)}</p>
  <p><strong>Content Description:</strong> ${escapeHtml(data.CONTENT_DESCRIPTION)}</p>

  <h2>3. Agreement Dates</h2>
  <p><strong>Agreement Date:</strong> ${escapeHtml(data.AGREEMENT_DATE)}</p>
  <p><strong>Rights Valid From:</strong> ${escapeHtml(data.VALID_FROM)}</p>
  <p><strong>Rights Valid Until:</strong> ${escapeHtml(data.VALID_UNTIL)}</p>

  <h2>4. Usage Rights</h2>
  <p>Usage rights are granted strictly as indicated below. Any usage category not explicitly granted is not permitted.</p>
  
  <table>
    <thead>
      <tr>
        <th>Usage Category</th>
        <th>Granted</th>
        <th>Type</th>
        <th>Territories</th>
        <th>Period</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Digital (Web, Social Media, Email)</td>
        <td>${escapeHtml(data.DIGITAL_GRANTED)}</td>
        <td>${escapeHtml(data.DIGITAL_TYPE)}</td>
        <td>${escapeHtml(data.DIGITAL_TERRITORIES)}</td>
        <td>${escapeHtml(data.DIGITAL_PERIOD)}</td>
      </tr>
      <tr>
        <td>Paid Media (Advertising, Sponsored)</td>
        <td>${escapeHtml(data.PAID_MEDIA_GRANTED)}</td>
        <td>${escapeHtml(data.PAID_MEDIA_TYPE)}</td>
        <td>${escapeHtml(data.PAID_MEDIA_TERRITORIES)}</td>
        <td>${escapeHtml(data.PAID_MEDIA_PERIOD)}</td>
      </tr>
      <tr>
        <td>POS / Retail (In-store, Displays)</td>
        <td>${escapeHtml(data.POS_GRANTED)}</td>
        <td>${escapeHtml(data.POS_TYPE)}</td>
        <td>${escapeHtml(data.POS_TERRITORIES)}</td>
        <td>${escapeHtml(data.POS_PERIOD)}</td>
      </tr>
      <tr>
        <td>Print (Magazines, Brochures)</td>
        <td>${escapeHtml(data.PRINT_GRANTED)}</td>
        <td>${escapeHtml(data.PRINT_TYPE)}</td>
        <td>${escapeHtml(data.PRINT_TERRITORIES)}</td>
        <td>${escapeHtml(data.PRINT_PERIOD)}</td>
      </tr>
      <tr>
        <td>OOH (Billboards, Street Furniture)</td>
        <td>${escapeHtml(data.OOH_GRANTED)}</td>
        <td>${escapeHtml(data.OOH_TYPE)}</td>
        <td>${escapeHtml(data.OOH_TERRITORIES)}</td>
        <td>${escapeHtml(data.OOH_PERIOD)}</td>
      </tr>
      <tr>
        <td>TV (Broadcast, Streaming)</td>
        <td>${escapeHtml(data.TV_GRANTED)}</td>
        <td>${escapeHtml(data.TV_TYPE)}</td>
        <td>${escapeHtml(data.TV_TERRITORIES)}</td>
        <td>${escapeHtml(data.TV_PERIOD)}</td>
      </tr>
    </tbody>
  </table>

  <h2>5. Terms and Conditions</h2>
  <h3>5.1 Grant of Rights (Non-Exclusive License)</h3>
  <p>Subject to the terms of this Agreement and the Usage Rights table in Section 4, the Licensor grants the Licensee a non-exclusive, non-transferable license to use the video content and associated deliverables described in Section 2 solely for the permitted usage categories, territories, and periods indicated in Section 4.</p>

  <h3>5.2 Restrictions</h3>
  <p>Unless expressly agreed in writing by the Licensor, the Licensee shall not:</p>
  <ol>
    <li>Sublicense, assign, or otherwise transfer the rights granted under this Agreement to any third party.</li>
    <li>Use the Content in any unlawful, misleading, defamatory, or infringing manner.</li>
    <li>Use the Content outside the granted category, territory, or period specified in Section 4.</li>
  </ol>

  <h3>5.3 Credit / Attribution</h3>
  <p>Where reasonably practicable, the Licensee shall include credit substantially as follows: "Content produced by The New Face."</p>

  <h3>5.4 Modifications and Formatting</h3>
  <p>The Licensee may perform technical formatting required for distribution, provided that such changes do not substantively alter the Content or misrepresent the Licensor's work.</p>

  <h3>5.5 Term and Expiry</h3>
  <p>This Agreement is effective from ${escapeHtml(data.VALID_FROM)} and remains in effect until ${escapeHtml(data.VALID_UNTIL)}, unless terminated earlier.</p>

  <h3>5.6 Termination</h3>
  <p>Either Party may terminate this Agreement for material breach by the other Party, if such breach is not cured within ten (10) business days of written notice.</p>

  <h3>5.7 Governing Law</h3>
  <p>This Agreement shall be governed by and construed in accordance with the laws of France.</p>

  <h3>5.8 Electronic Signature</h3>
  <p>This Agreement may be executed electronically. Electronic signatures shall be deemed original and binding.</p>

  <div class="footer">
    <p>CONFIDENTIAL — Video Content Usage Rights Agreement</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const signwellApiKey = Deno.env.get('SIGNWELL_API_KEY')!;

    if (!signwellApiKey) {
      throw new Error('SIGNWELL_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { agreementId, testMode = true } = await req.json();

    if (!agreementId) {
      return new Response(
        JSON.stringify({ error: 'Missing agreementId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending agreement ${agreementId} to SignWell (testMode: ${testMode})`);

    // Fetch agreement data
    const { data: agreement, error: agreementError } = await supabase
      .from('rights_agreements')
      .select('*, projects(name, description, client_name)')
      .eq('id', agreementId)
      .single();

    if (agreementError || !agreement) {
      console.error('Agreement fetch error:', agreementError);
      return new Response(
        JSON.stringify({ error: 'Agreement not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (agreement.signwell_document_id) {
      return new Response(
        JSON.stringify({ error: 'Agreement already sent for signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch usage selections
    const { data: selections } = await supabase
      .from('rights_usage_selections')
      .select('*')
      .eq('agreement_id', agreementId);

    // Build template data
    const project = agreement.projects as { name: string; description: string | null; client_name: string | null } | null;
    
    const templateData: Record<string, string> = {
      CLIENT_NAME: agreement.client_name,
      CLIENT_CONTACT_NAME: agreement.client_contact_name || '',
      CLIENT_EMAIL: agreement.client_email,
      PROJECT_NAME: project?.name || '',
      CONTENT_DESCRIPTION: project?.description || 'Video content as per project scope',
      AGREEMENT_DATE: formatDate(agreement.agreement_date),
      VALID_FROM: formatDate(agreement.valid_from),
      VALID_UNTIL: agreement.valid_until ? formatDate(agreement.valid_until) : 'Perpetual',
    };

    // Initialize all usage categories as "Not Granted"
    const categories = ['DIGITAL', 'PAID_MEDIA', 'POS', 'PRINT', 'OOH', 'TV'];
    for (const cat of categories) {
      templateData[`${cat}_GRANTED`] = 'No';
      templateData[`${cat}_TYPE`] = '—';
      templateData[`${cat}_TERRITORIES`] = '—';
      templateData[`${cat}_PERIOD`] = '—';
    }

    // Fill in granted categories
    if (selections) {
      for (const sel of selections as UsageSelection[]) {
        const catKey = CATEGORY_MAP[sel.category];
        if (catKey) {
          templateData[`${catKey}_GRANTED`] = 'Yes';
          templateData[`${catKey}_TYPE`] = sel.is_paid ? 'Paid' : 'Organic';
          templateData[`${catKey}_TERRITORIES`] = sel.geographies.join(', ') || 'Not specified';
          templateData[`${catKey}_PERIOD`] = formatPeriod(sel.period_start, sel.period_end);
        }
      }
    }

    // Generate HTML document
    const htmlContent = generateAgreementHtml(templateData);

    // Convert HTML to base64 for SignWell
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(htmlContent);
    const base64Content = btoa(String.fromCharCode(...htmlBytes));

    // Create document in SignWell
    const signwellPayload = {
      test_mode: testMode,
      files: [
        {
          name: `rights-agreement-${agreement.client_name.replace(/\s+/g, '-').toLowerCase()}.html`,
          file_base64: base64Content,
        }
      ],
      name: `Video Content Usage Rights Agreement - ${agreement.client_name}`,
      subject: 'Video Content Usage Rights Agreement Ready for Signature',
      message: `Dear ${agreement.client_contact_name || agreement.client_name},\n\nPlease review and sign the attached Video Content Usage Rights Agreement for the project "${project?.name || 'your project'}".\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe New Face`,
      recipients: [
        {
          id: 'client',
          name: agreement.client_contact_name || agreement.client_name,
          email: agreement.client_email,
          send_email: true,
          signing_order: 1,
        }
      ],
      draft: false,
      with_signature_page: true,
      reminders: true,
    };

    console.log('Sending to SignWell API...');

    const signwellResponse = await fetch(`${SIGNWELL_API_URL}/documents`, {
      method: 'POST',
      headers: {
        'X-Api-Key': signwellApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signwellPayload),
    });

    if (!signwellResponse.ok) {
      const errorText = await signwellResponse.text();
      console.error('SignWell API error:', signwellResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `SignWell API error: ${signwellResponse.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signwellResult = await signwellResponse.json();
    console.log('SignWell document created:', signwellResult.id);

    // Update agreement with SignWell document ID and status
    const { error: updateError } = await supabase
      .from('rights_agreements')
      .update({
        signwell_document_id: signwellResult.id,
        status: 'sent',
      })
      .eq('id', agreementId);

    if (updateError) {
      console.error('Failed to update agreement:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        signwellDocumentId: signwellResult.id,
        message: `Agreement sent to ${agreement.client_email} for signature`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error sending to SignWell:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
