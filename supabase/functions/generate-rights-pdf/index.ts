import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UsageSelection {
  category: string;
  is_paid: boolean;
  geographies: string[];
  period_start: string;
  period_end: string | null;
}

interface AgreementData {
  agreementId: string;
}

// Category display mapping
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agreementId } = await req.json() as AgreementData;

    if (!agreementId) {
      return new Response(
        JSON.stringify({ error: 'Missing agreementId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating PDF for agreement: ${agreementId}`);

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

    // Fetch usage selections
    const { data: selections, error: selectionsError } = await supabase
      .from('rights_usage_selections')
      .select('*')
      .eq('agreement_id', agreementId);

    if (selectionsError) {
      console.error('Selections fetch error:', selectionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch usage selections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${selections?.length || 0} usage selections`);

    // Build template data
    const project = agreement.projects as { name: string; description: string | null; client_name: string | null } | null;
    
    const templateData: Record<string, string> = {
      CLIENT_NAME: agreement.client_name,
      CLIENT_CONTACT_NAME: agreement.client_contact_name || '',
      CLIENT_EMAIL: agreement.client_email,
      CLIENT_ADDRESS: '', // Not stored, leave blank
      PROJECT_NAME: project?.name || '',
      CONTENT_DESCRIPTION: project?.description || 'Video content as per project scope',
      AGREEMENT_DATE: formatDate(agreement.agreement_date),
      VALID_FROM: formatDate(agreement.valid_from),
      VALID_UNTIL: agreement.valid_until ? formatDate(agreement.valid_until) : 'Perpetual',
      GOVERNING_LAW: 'France',
      // Signatures - left blank for DocuSign
      TNF_SIGNATURE: '',
      CLIENT_SIGNATURE: '',
      CLIENT_SIGNER_NAME: agreement.client_contact_name || '',
      CLIENT_SIGNER_TITLE: '',
      TNF_SIGN_DATE: '',
      CLIENT_SIGN_DATE: '',
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

    console.log('Template data prepared:', Object.keys(templateData).length, 'fields');

    // Generate HTML document with styling
    const htmlContent = generateAgreementHtml(templateData);

    // Store the generated HTML (we'll convert to PDF in Phase 3 with a proper PDF service)
    // For now, we generate an HTML file that can be viewed/printed as PDF
    const fileName = `${agreementId}/agreement.html`;
    const { error: uploadError } = await supabase.storage
      .from('rights-agreements')
      .upload(fileName, htmlContent, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to store generated document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signed URL for the document
    const { data: signedUrl } = await supabase.storage
      .from('rights-agreements')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    // Update agreement with document path
    await supabase
      .from('rights_agreements')
      .update({ generated_document_path: fileName })
      .eq('id', agreementId);

    console.log('Document generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentPath: fileName,
        documentUrl: signedUrl?.signedUrl,
        templateData, // Include for debugging/preview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    h1 {
      text-align: center;
      font-size: 16pt;
      margin-bottom: 30px;
      text-transform: uppercase;
    }
    h2 {
      font-size: 12pt;
      margin-top: 24px;
      margin-bottom: 12px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 11pt;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .party-block {
      margin: 16px 0;
      padding-left: 20px;
    }
    .party-block p {
      margin: 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .signature-table {
      margin-top: 40px;
    }
    .signature-table td {
      width: 50%;
      vertical-align: top;
      padding: 12px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: 40px;
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      font-size: 9pt;
      color: #666;
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ccc;
    }
    ol {
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
    }
    @media print {
      body { padding: 0; }
    }
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
    <p><strong>Address:</strong> ${escapeHtml(data.CLIENT_ADDRESS) || '___________________________'}</p>
  </div>
  
  <p>The Licensor and Licensee may each be referred to as a "Party" and collectively as the "Parties."</p>

  <h2>2. Content Description</h2>
  <p><strong>Project Name:</strong> ${escapeHtml(data.PROJECT_NAME)}</p>
  <p><strong>Content Description:</strong> ${escapeHtml(data.CONTENT_DESCRIPTION)}</p>
  <p><strong>Deliverables Reference:</strong> (as per project documentation)</p>

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
  <p>Subject to the terms of this Agreement and the Usage Rights table in Section 4, the Licensor grants the Licensee a non-exclusive, non-transferable license to use the video content and associated deliverables described in Section 2 (the "Content") solely for the permitted usage categories, territories, and periods indicated in Section 4.</p>
  <p>No rights are granted by implication. All rights not expressly granted to the Licensee are reserved by the Licensor.</p>

  <h3>5.2 Restrictions</h3>
  <p>Unless expressly agreed in writing by the Licensor, the Licensee shall not:</p>
  <ol>
    <li>Sublicense, assign, or otherwise transfer the rights granted under this Agreement to any third party.</li>
    <li>Use the Content in any unlawful, misleading, defamatory, or infringing manner.</li>
    <li>Use the Content outside the granted category, territory, or period specified in Section 4.</li>
  </ol>

  <h3>5.3 Credit / Attribution</h3>
  <p>Where reasonably practicable (e.g., online captions, video descriptions, campaign credits, press releases, or case studies), the Licensee shall include credit substantially as follows: "Content produced by The New Face."</p>

  <h3>5.4 Modifications and Formatting</h3>
  <p>The Licensee may perform technical formatting required for distribution, including cropping, resizing, compression, aspect ratio adjustments, captioning, and minor length edits (e.g., cut-downs), provided that such changes do not substantively alter the Content, misrepresent the Licensor's work, or create a misleading context.</p>
  <p>The Licensee shall not materially modify the Content (including altering key visuals, compositing new scenes, changing narrative meaning, removing or replacing branding elements, or using AI-based transformations) without the Licensor's prior written consent.</p>

  <h3>5.5 Term and Expiry</h3>
  <p>This Agreement is effective from ${escapeHtml(data.VALID_FROM)} and remains in effect until ${escapeHtml(data.VALID_UNTIL)}, unless terminated earlier in accordance with Section 5.6.</p>
  <p>Upon expiry (or earlier termination), the Licensee must cease new use of the Content in any category whose Period has ended and must remove/withdraw placements where reasonably possible, except for:</p>
  <ul>
    <li>archival copies retained for legal/compliance purposes; and</li>
    <li>non-cancellable media buys already placed in good faith prior to expiry (limited to the shortest practicable run), unless the Licensee is in breach of this Agreement.</li>
  </ul>

  <h3>5.6 Termination</h3>
  <p>Either Party may terminate this Agreement:</p>
  <ol>
    <li>For material breach by the other Party, if such breach is not cured within ten (10) business days of written notice; or</li>
    <li>Immediately if the other Party becomes insolvent, enters liquidation, or is unable to pay its debts as they fall due.</li>
  </ol>
  <p>Upon termination, all licenses granted under this Agreement cease, and the Licensee must promptly discontinue use of the Content, subject to reasonable takedown periods and any exceptions expressly stated in Section 5.5.</p>

  <h3>5.7 Governing Law</h3>
  <p>This Agreement shall be governed by and construed in accordance with the laws of ${escapeHtml(data.GOVERNING_LAW)}, without regard to conflict-of-law principles.</p>

  <h3>5.8 Entire Agreement</h3>
  <p>This Agreement (including the Usage Rights table) constitutes the entire agreement between the Parties regarding the licensing of the Content and supersedes all prior discussions or understandings relating to the same subject matter.</p>

  <h3>5.9 Counterparts and Electronic Signature</h3>
  <p>This Agreement may be executed in counterparts and signed electronically. Electronic signatures (including via DocuSign or equivalent) shall be deemed original and binding.</p>

  <h2>6. Signatures</h2>
  <p>IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Agreement Date.</p>

  <table class="signature-table">
    <tr>
      <td>
        <p><strong>LICENSOR (The New Face)</strong></p>
        <p>Signature:</p>
        <div class="signature-line"></div>
        <p>Printed Name: Victor Haymann</p>
        <p>Title: COO</p>
        <p>Date: _______________</p>
      </td>
      <td>
        <p><strong>LICENSEE (Client)</strong></p>
        <p>Signature:</p>
        <div class="signature-line"></div>
        <p>Printed Name: ${escapeHtml(data.CLIENT_SIGNER_NAME) || '_______________'}</p>
        <p>Title: ${escapeHtml(data.CLIENT_SIGNER_TITLE) || '_______________'}</p>
        <p>Date: _______________</p>
      </td>
    </tr>
  </table>

  <div class="footer">
    <p>CONFIDENTIAL — Video Content Usage Rights Agreement</p>
  </div>
</body>
</html>`;
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
