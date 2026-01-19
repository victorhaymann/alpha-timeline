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

// Proper UTF-8 to Base64 encoding for special characters
function utf8ToBase64(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

// TNF Logo as SVG (embedded for reliability)
const TNF_LOGO_SVG = `<svg width="180" height="40" viewBox="0 0 180 40" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="28" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#000">THE NEW FACE</text>
</svg>`;

function generateAgreementHtml(data: Record<string, string>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Content Usage Rights Agreement</title>
  <style>
    @page { 
      size: A4; 
      margin: 20mm 20mm 25mm 20mm;
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #666;
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: #fff;
    }
    
    .document-container {
      padding: 40px 50px;
    }
    
    /* Header with logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1a1a1a;
    }
    
    .header-left {
      flex: 1;
    }
    
    .header-right {
      text-align: right;
    }
    
    .logo {
      max-width: 180px;
      height: auto;
    }
    
    .document-title {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 5px 0;
      color: #1a1a1a;
    }
    
    .document-subtitle {
      font-size: 10pt;
      color: #666;
      margin: 0;
    }
    
    /* Section styling */
    .section {
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }
    
    .subsection-title {
      font-size: 10pt;
      font-weight: bold;
      color: #333;
      margin: 16px 0 8px 0;
    }
    
    /* Party blocks */
    .parties-container {
      display: flex;
      gap: 40px;
      margin: 16px 0;
    }
    
    .party-block {
      flex: 1;
      background: #f9f9f9;
      padding: 16px 20px;
      border-radius: 4px;
      border-left: 3px solid #1a1a1a;
    }
    
    .party-block h4 {
      font-size: 10pt;
      font-weight: bold;
      margin: 0 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .party-block p {
      margin: 4px 0;
      font-size: 10pt;
    }
    
    .party-block .label {
      color: #666;
      font-size: 9pt;
    }
    
    /* Content details */
    .detail-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px 16px;
      margin: 12px 0;
    }
    
    .detail-label {
      font-weight: bold;
      color: #333;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .detail-value {
      color: #1a1a1a;
    }
    
    /* Usage rights table */
    .usage-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9pt;
    }
    
    .usage-table th {
      background-color: #1a1a1a;
      color: #fff;
      font-weight: bold;
      text-align: left;
      padding: 10px 12px;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .usage-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    
    .usage-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .usage-table tr:hover {
      background-color: #f0f0f0;
    }
    
    .granted-yes {
      color: #0a7c42;
      font-weight: bold;
    }
    
    .granted-no {
      color: #999;
    }
    
    /* Terms section */
    .terms-section {
      margin-top: 24px;
    }
    
    .terms-section p {
      margin: 8px 0;
      text-align: justify;
    }
    
    .terms-section ol, .terms-section ul {
      margin: 8px 0 8px 20px;
      padding-left: 0;
    }
    
    .terms-section li {
      margin: 6px 0;
      text-align: justify;
    }
    
    /* Signature section */
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    
    .signature-intro {
      margin-bottom: 30px;
      font-style: italic;
    }
    
    .signature-grid {
      display: flex;
      gap: 40px;
    }
    
    .signature-block {
      flex: 1;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 4px;
    }
    
    .signature-block h4 {
      font-size: 10pt;
      font-weight: bold;
      margin: 0 0 20px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }
    
    .signature-field {
      margin: 12px 0;
    }
    
    .signature-field .label {
      font-size: 9pt;
      color: #666;
      margin-bottom: 4px;
    }
    
    .signature-line {
      border-bottom: 1px solid #1a1a1a;
      height: 30px;
      margin-top: 4px;
    }
    
    .signature-field .value {
      font-size: 10pt;
      padding-top: 4px;
    }
    
    /* Footer */
    .document-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      text-align: center;
    }
    
    .confidential-notice {
      font-size: 9pt;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .footer-meta {
      font-size: 8pt;
      color: #999;
      margin-top: 8px;
    }
    
    /* Print styles */
    @media print {
      body { 
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .document-container {
        padding: 0;
      }
      .section {
        page-break-inside: avoid;
      }
      .signature-section {
        page-break-before: auto;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <header class="header">
      <div class="header-left">
        <h1 class="document-title">Video Content Usage Rights Agreement</h1>
        <p class="document-subtitle">Non-Exclusive License Agreement</p>
      </div>
      <div class="header-right">
        ${TNF_LOGO_SVG}
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">1. Parties</h2>
      <p>This Video Content Usage Rights Agreement (the "Agreement") is entered into by and between:</p>
      
      <div class="parties-container">
        <div class="party-block">
          <h4>Licensor</h4>
          <p><strong>The New Face</strong></p>
          <p><span class="label">Address:</span><br>23 Rue des Petits Hotels<br>75010, Paris, France</p>
        </div>
        
        <div class="party-block">
          <h4>Licensee (Client)</h4>
          <p><strong>${escapeHtml(data.CLIENT_NAME)}</strong></p>
          <p><span class="label">Contact:</span> ${escapeHtml(data.CLIENT_CONTACT_NAME) || 'N/A'}</p>
          <p><span class="label">Email:</span> ${escapeHtml(data.CLIENT_EMAIL)}</p>
        </div>
      </div>
      
      <p>The Licensor and Licensee may each be referred to as a "Party" and collectively as the "Parties."</p>
    </section>

    <section class="section">
      <h2 class="section-title">2. Content Description</h2>
      <div class="detail-grid">
        <span class="detail-label">Project Name</span>
        <span class="detail-value">${escapeHtml(data.PROJECT_NAME)}</span>
        
        <span class="detail-label">Description</span>
        <span class="detail-value">${escapeHtml(data.CONTENT_DESCRIPTION)}</span>
        
        <span class="detail-label">Deliverables</span>
        <span class="detail-value">As per project documentation</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">3. Agreement Dates</h2>
      <div class="detail-grid">
        <span class="detail-label">Agreement Date</span>
        <span class="detail-value">${escapeHtml(data.AGREEMENT_DATE)}</span>
        
        <span class="detail-label">Rights Valid From</span>
        <span class="detail-value">${escapeHtml(data.VALID_FROM)}</span>
        
        <span class="detail-label">Rights Valid Until</span>
        <span class="detail-value">${escapeHtml(data.VALID_UNTIL)}</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">4. Usage Rights</h2>
      <p>Usage rights are granted strictly as indicated below. Any usage category not explicitly granted is not permitted.</p>
      
      <table class="usage-table">
        <thead>
          <tr>
            <th style="width: 30%">Usage Category</th>
            <th style="width: 12%">Granted</th>
            <th style="width: 12%">Type</th>
            <th style="width: 22%">Territories</th>
            <th style="width: 24%">Period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Digital (Web, Social Media, Email)</td>
            <td class="${data.DIGITAL_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.DIGITAL_GRANTED)}</td>
            <td>${data.DIGITAL_GRANTED === 'Yes' ? escapeHtml(data.DIGITAL_TYPE) : '-'}</td>
            <td>${data.DIGITAL_GRANTED === 'Yes' ? escapeHtml(data.DIGITAL_TERRITORIES) : '-'}</td>
            <td>${data.DIGITAL_GRANTED === 'Yes' ? escapeHtml(data.DIGITAL_PERIOD) : '-'}</td>
          </tr>
          <tr>
            <td>Paid Media (Advertising, Sponsored)</td>
            <td class="${data.PAID_MEDIA_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.PAID_MEDIA_GRANTED)}</td>
            <td>${data.PAID_MEDIA_GRANTED === 'Yes' ? escapeHtml(data.PAID_MEDIA_TYPE) : '-'}</td>
            <td>${data.PAID_MEDIA_GRANTED === 'Yes' ? escapeHtml(data.PAID_MEDIA_TERRITORIES) : '-'}</td>
            <td>${data.PAID_MEDIA_GRANTED === 'Yes' ? escapeHtml(data.PAID_MEDIA_PERIOD) : '-'}</td>
          </tr>
          <tr>
            <td>POS / Retail (In-store, Displays)</td>
            <td class="${data.POS_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.POS_GRANTED)}</td>
            <td>${data.POS_GRANTED === 'Yes' ? escapeHtml(data.POS_TYPE) : '-'}</td>
            <td>${data.POS_GRANTED === 'Yes' ? escapeHtml(data.POS_TERRITORIES) : '-'}</td>
            <td>${data.POS_GRANTED === 'Yes' ? escapeHtml(data.POS_PERIOD) : '-'}</td>
          </tr>
          <tr>
            <td>Print (Magazines, Brochures)</td>
            <td class="${data.PRINT_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.PRINT_GRANTED)}</td>
            <td>${data.PRINT_GRANTED === 'Yes' ? escapeHtml(data.PRINT_TYPE) : '-'}</td>
            <td>${data.PRINT_GRANTED === 'Yes' ? escapeHtml(data.PRINT_TERRITORIES) : '-'}</td>
            <td>${data.PRINT_GRANTED === 'Yes' ? escapeHtml(data.PRINT_PERIOD) : '-'}</td>
          </tr>
          <tr>
            <td>OOH (Billboards, Street Furniture)</td>
            <td class="${data.OOH_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.OOH_GRANTED)}</td>
            <td>${data.OOH_GRANTED === 'Yes' ? escapeHtml(data.OOH_TYPE) : '-'}</td>
            <td>${data.OOH_GRANTED === 'Yes' ? escapeHtml(data.OOH_TERRITORIES) : '-'}</td>
            <td>${data.OOH_GRANTED === 'Yes' ? escapeHtml(data.OOH_PERIOD) : '-'}</td>
          </tr>
          <tr>
            <td>TV (Broadcast, Streaming)</td>
            <td class="${data.TV_GRANTED === 'Yes' ? 'granted-yes' : 'granted-no'}">${escapeHtml(data.TV_GRANTED)}</td>
            <td>${data.TV_GRANTED === 'Yes' ? escapeHtml(data.TV_TYPE) : '-'}</td>
            <td>${data.TV_GRANTED === 'Yes' ? escapeHtml(data.TV_TERRITORIES) : '-'}</td>
            <td>${data.TV_GRANTED === 'Yes' ? escapeHtml(data.TV_PERIOD) : '-'}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="section terms-section">
      <h2 class="section-title">5. Terms and Conditions</h2>

      <h3 class="subsection-title">5.1 Grant of Rights (Non-Exclusive License)</h3>
      <p>Subject to the terms of this Agreement and the Usage Rights table in Section 4, the Licensor grants the Licensee a non-exclusive, non-transferable license to use the video content and associated deliverables described in Section 2 (the "Content") solely for the permitted usage categories, territories, and periods indicated in Section 4.</p>
      <p>No rights are granted by implication. All rights not expressly granted to the Licensee are reserved by the Licensor.</p>

      <h3 class="subsection-title">5.2 Restrictions</h3>
      <p>Unless expressly agreed in writing by the Licensor, the Licensee shall not:</p>
      <ol>
        <li>Sublicense, assign, or otherwise transfer the rights granted under this Agreement to any third party.</li>
        <li>Use the Content in any unlawful, misleading, defamatory, or infringing manner.</li>
        <li>Use the Content outside the granted category, territory, or period specified in Section 4.</li>
      </ol>

      <h3 class="subsection-title">5.3 Credit / Attribution</h3>
      <p>Where reasonably practicable (e.g., online captions, video descriptions, campaign credits, press releases, or case studies), the Licensee shall include credit substantially as follows: "Content produced by The New Face."</p>

      <h3 class="subsection-title">5.4 Modifications and Formatting</h3>
      <p>The Licensee may perform technical formatting required for distribution, including cropping, resizing, compression, aspect ratio adjustments, captioning, and minor length edits (e.g., cut-downs), provided that such changes do not substantively alter the Content, misrepresent the Licensor's work, or create a misleading context.</p>
      <p>The Licensee shall not materially modify the Content (including altering key visuals, compositing new scenes, changing narrative meaning, removing or replacing branding elements, or using AI-based transformations) without the Licensor's prior written consent.</p>

      <h3 class="subsection-title">5.5 Term and Expiry</h3>
      <p>This Agreement is effective from ${escapeHtml(data.VALID_FROM)} and remains in effect until ${escapeHtml(data.VALID_UNTIL)}, unless terminated earlier in accordance with Section 5.6.</p>
      <p>Upon expiry (or earlier termination), the Licensee must cease new use of the Content in any category whose Period has ended and must remove/withdraw placements where reasonably possible, except for:</p>
      <ul>
        <li>archival copies retained for legal/compliance purposes; and</li>
        <li>non-cancellable media buys already placed in good faith prior to expiry (limited to the shortest practicable run), unless the Licensee is in breach of this Agreement.</li>
      </ul>

      <h3 class="subsection-title">5.6 Termination</h3>
      <p>Either Party may terminate this Agreement:</p>
      <ol>
        <li>For material breach by the other Party, if such breach is not cured within ten (10) business days of written notice; or</li>
        <li>Immediately if the other Party becomes insolvent, enters liquidation, or is unable to pay its debts as they fall due.</li>
      </ol>
      <p>Upon termination, all licenses granted under this Agreement cease, and the Licensee must promptly discontinue use of the Content, subject to reasonable takedown periods and any exceptions expressly stated in Section 5.5.</p>

      <h3 class="subsection-title">5.7 Governing Law</h3>
      <p>This Agreement shall be governed by and construed in accordance with the laws of ${escapeHtml(data.GOVERNING_LAW)}, without regard to conflict-of-law principles.</p>

      <h3 class="subsection-title">5.8 Entire Agreement</h3>
      <p>This Agreement (including the Usage Rights table) constitutes the entire agreement between the Parties regarding the licensing of the Content and supersedes all prior discussions or understandings relating to the same subject matter.</p>

      <h3 class="subsection-title">5.9 Counterparts and Electronic Signature</h3>
      <p>This Agreement may be executed in counterparts and signed electronically. Electronic signatures (including via DocuSign or equivalent) shall be deemed original and binding.</p>
    </section>

    <section class="section signature-section">
      <h2 class="section-title">6. Signatures</h2>
      <p class="signature-intro">IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Agreement Date.</p>

      <div class="signature-grid">
        <div class="signature-block">
          <h4>Licensor (The New Face)</h4>
          <div class="signature-field">
            <div class="label">Signature</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-field">
            <div class="label">Printed Name</div>
            <div class="value">Victor Haymann</div>
          </div>
          <div class="signature-field">
            <div class="label">Title</div>
            <div class="value">COO</div>
          </div>
          <div class="signature-field">
            <div class="label">Date</div>
            <div class="signature-line"></div>
          </div>
        </div>

        <div class="signature-block">
          <h4>Licensee (Client)</h4>
          <div class="signature-field">
            <div class="label">Signature</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-field">
            <div class="label">Printed Name</div>
            <div class="value">${escapeHtml(data.CLIENT_SIGNER_NAME) || '________________________'}</div>
          </div>
          <div class="signature-field">
            <div class="label">Title</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-field">
            <div class="label">Date</div>
            <div class="signature-line"></div>
          </div>
        </div>
      </div>
    </section>

    <footer class="document-footer">
      <p class="confidential-notice">Confidential - Video Content Usage Rights Agreement</p>
      <p class="footer-meta">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </footer>
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
      GOVERNING_LAW: 'France',
      CLIENT_SIGNER_NAME: agreement.client_contact_name || '',
    };

    // Initialize all usage categories as "Not Granted"
    const categories = ['DIGITAL', 'PAID_MEDIA', 'POS', 'PRINT', 'OOH', 'TV'];
    for (const cat of categories) {
      templateData[`${cat}_GRANTED`] = 'No';
      templateData[`${cat}_TYPE`] = '-';
      templateData[`${cat}_TERRITORIES`] = '-';
      templateData[`${cat}_PERIOD`] = '-';
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

    // Use proper UTF-8 to Base64 encoding
    const base64Content = utf8ToBase64(htmlContent);

    // Create document in SignWell
    const signwellPayload = {
      test_mode: testMode,
      files: [
        {
          name: `rights-agreement-${agreement.client_name.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          file_base64: base64Content,
        }
      ],
      name: `Video Content Usage Rights Agreement - ${agreement.client_name}`,
      subject: 'Video Content Usage Rights Agreement Ready for Signature',
      message: `Please review and sign the attached Video Content Usage Rights Agreement for the project "${project?.name || 'your project'}".\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe New Face`,
      recipients: [
        {
          id: 'tnf',
          name: 'The New Face',
          email: 'contact@thenewface.io',
          signing_order: 1,
        },
        {
          id: 'client',
          name: agreement.client_contact_name || agreement.client_name,
          email: agreement.client_email,
          signing_order: 2,
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
        message: `Agreement sent to The New Face and ${agreement.client_email} for signature`,
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
