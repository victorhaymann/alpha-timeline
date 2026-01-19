import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNWELL_API_URL = 'https://www.signwell.com/api/v1';
const TNF_EMAIL = 'victor@thenewface.io';

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

const CATEGORY_LABELS: Record<string, string> = {
  DIGITAL: 'Digital (Web, Social Media, Email)',
  PAID_MEDIA: 'Paid Media (Advertising, Sponsored)',
  POS: 'POS / Retail (In-store, Displays)',
  PRINT: 'Print (Magazines, Brochures)',
  OOH: 'OOH (Billboards, Street Furniture)',
  TV: 'TV (Broadcast, Streaming)',
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

// Generate PDF using jsPDF
function generateAgreementPdf(data: Record<string, string>): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, startY: number, maxWidth: number, lineHeight: number = 5): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, startY);
    return startY + (lines.length * lineHeight);
  };

  // Helper function to check page break
  const checkPageBreak = (neededSpace: number): void => {
    if (y + neededSpace > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // ========== HEADER ==========
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('THE NEW FACE USAGE RIGHTS AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Non-Exclusive License Agreement', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Header line
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ========== SECTION 1: PARTIES ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. PARTIES', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText('This Video Content Usage Rights Agreement (the "Agreement") is entered into by and between:', margin, y, contentWidth);
  y += 8;

  // Licensor box
  doc.setFillColor(249, 249, 249);
  doc.setDrawColor(26, 26, 26);
  doc.rect(margin, y, contentWidth / 2 - 5, 35, 'F');
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('LICENSOR', margin + 5, y + 7);
  doc.setFontSize(10);
  doc.text('The New Face', margin + 5, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Address:', margin + 5, y + 21);
  doc.text('23 Rue des Petits Hotels', margin + 5, y + 26);
  doc.text('75010, Paris, France', margin + 5, y + 31);

  // Licensee box
  const licBox = margin + contentWidth / 2 + 5;
  doc.setFillColor(249, 249, 249);
  doc.rect(licBox, y, contentWidth / 2 - 5, 35, 'F');
  doc.line(licBox, y, licBox, y + 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('LICENSEE (CLIENT)', licBox + 5, y + 7);
  doc.setFontSize(10);
  doc.text(data.CLIENT_NAME || 'N/A', licBox + 5, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Contact: ${data.CLIENT_CONTACT_NAME || 'N/A'}`, licBox + 5, y + 21);
  doc.text(`Email: ${data.CLIENT_EMAIL || 'N/A'}`, licBox + 5, y + 28);

  y += 42;

  doc.setFontSize(10);
  y = addWrappedText('The Licensor and Licensee may each be referred to as a "Party" and collectively as the "Parties."', margin, y, contentWidth);
  y += 10;

  // ========== SECTION 2: CONTENT DESCRIPTION ==========
  checkPageBreak(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. CONTENT DESCRIPTION', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.PROJECT_NAME || 'N/A', margin + 30, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Description:', margin, y);
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(data.CONTENT_DESCRIPTION || 'As per project documentation', contentWidth - 30);
  doc.text(descLines, margin + 30, y);
  y += descLines.length * 4.5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Deliverables:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.DELIVERABLES || 'As per Quotation', margin + 30, y);
  y += 10;

  // ========== SECTION 3: AGREEMENT DATES ==========
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. AGREEMENT DATES', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Agreement Date:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.AGREEMENT_DATE || 'N/A', margin + 35, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Rights Valid From:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.VALID_FROM || 'N/A', margin + 35, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Rights Valid Until:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.VALID_UNTIL || 'N/A', margin + 35, y);
  y += 12;

  // ========== SECTION 4: USAGE RIGHTS TABLE ==========
  checkPageBreak(80);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. USAGE RIGHTS', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText('Usage rights are granted strictly as indicated below. Any usage category not explicitly granted is not permitted.', margin, y, contentWidth, 4);
  y += 6;

  // Table headers
  const colWidths = [50, 18, 20, 35, 49];
  const tableX = margin;
  
  doc.setFillColor(26, 26, 26);
  doc.rect(tableX, y, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  let colX = tableX + 2;
  doc.text('USAGE CATEGORY', colX, y + 5.5);
  colX += colWidths[0];
  doc.text('GRANTED', colX, y + 5.5);
  colX += colWidths[1];
  doc.text('TYPE', colX, y + 5.5);
  colX += colWidths[2];
  doc.text('TERRITORIES', colX, y + 5.5);
  colX += colWidths[3];
  doc.text('PERIOD', colX, y + 5.5);
  
  y += 8;
  doc.setTextColor(0, 0, 0);

  // Table rows
  const categories = ['DIGITAL', 'PAID_MEDIA', 'POS', 'PRINT', 'OOH', 'TV'];
  
  categories.forEach((cat, index) => {
    checkPageBreak(10);
    
    if (index % 2 === 1) {
      doc.setFillColor(249, 249, 249);
      doc.rect(tableX, y, contentWidth, 8, 'F');
    }
    
    doc.setDrawColor(224, 224, 224);
    doc.line(tableX, y + 8, tableX + contentWidth, y + 8);
    
    colX = tableX + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Category label
    doc.text(CATEGORY_LABELS[cat] || cat, colX, y + 5.5);
    colX += colWidths[0];
    
    // Granted
    const granted = data[`${cat}_GRANTED`] || 'No';
    if (granted === 'Yes') {
      doc.setTextColor(10, 124, 66);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(153, 153, 153);
    }
    doc.text(granted, colX, y + 5.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    colX += colWidths[1];
    
    // Type
    doc.text(granted === 'Yes' ? (data[`${cat}_TYPE`] || '-') : '-', colX, y + 5.5);
    colX += colWidths[2];
    
    // Territories (may need truncation)
    const territories = granted === 'Yes' ? (data[`${cat}_TERRITORIES`] || '-') : '-';
    const truncTerr = territories.length > 20 ? territories.substring(0, 17) + '...' : territories;
    doc.text(truncTerr, colX, y + 5.5);
    colX += colWidths[3];
    
    // Period (show full date range)
    const period = granted === 'Yes' ? (data[`${cat}_PERIOD`] || '-') : '-';
    doc.setFontSize(7);
    doc.text(period, colX, y + 5.5);
    doc.setFontSize(8);
    
    y += 8;
  });

  y += 10;

  // ========== SECTION 5: TERMS AND CONDITIONS ==========
  checkPageBreak(60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. TERMS AND CONDITIONS', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.1 Grant of Rights (Non-Exclusive License)', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const grantText = 'Subject to the terms of this Agreement and the Usage Rights table in Section 4, the Licensor grants the Licensee a non-exclusive, non-transferable license to use the video content and associated deliverables described in Section 2 (the "Content") solely for the permitted usage categories, territories, and periods indicated in Section 4.';
  y = addWrappedText(grantText, margin, y, contentWidth, 4.5);
  y += 4;
  y = addWrappedText('No rights are granted by implication. All rights not expressly granted to the Licensee are reserved by the Licensor.', margin, y, contentWidth, 4.5);
  y += 8;

  checkPageBreak(40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.2 Restrictions', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = addWrappedText('The Licensee shall not:', margin, y, contentWidth, 4.5);
  y += 4;
  const restrictions = [
    'Sublicense, sell, or transfer the Content to any third party without prior written consent from the Licensor',
    'Modify, edit, or create derivative works from the Content without prior approval',
    'Use the Content in any manner that could be considered defamatory, obscene, or otherwise objectionable',
    'Use the Content beyond the specified territories, time periods, or usage categories without additional authorization'
  ];
  restrictions.forEach(r => {
    checkPageBreak(10);
    doc.text('•', margin + 2, y);
    y = addWrappedText(r, margin + 6, y, contentWidth - 6, 4.5);
    y += 2;
  });
  y += 6;

  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.3 Credit and Attribution', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = addWrappedText('Unless otherwise agreed in writing, the Licensee shall provide appropriate credit to The New Face in connection with any public use of the Content, in a manner consistent with industry standards.', margin, y, contentWidth, 4.5);
  y += 8;

  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.4 Ownership', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = addWrappedText('The Licensor retains all ownership rights, including copyright, in and to the Content. This Agreement does not transfer any ownership rights to the Licensee.', margin, y, contentWidth, 4.5);
  y += 8;

  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.5 Termination', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = addWrappedText('Either Party may terminate this Agreement upon written notice if the other Party materially breaches any term of this Agreement and fails to cure such breach within thirty (30) days of receiving written notice thereof. Upon termination, the Licensee shall immediately cease all use of the Content.', margin, y, contentWidth, 4.5);
  y += 8;

  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5.6 Governing Law', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = addWrappedText('This Agreement shall be governed by and construed in accordance with the laws of France. Any disputes arising from this Agreement shall be subject to the exclusive jurisdiction of the courts of Paris, France.', margin, y, contentWidth, 4.5);
  y += 12;

  // ========== SECTION 6: SIGNATURES ==========
  checkPageBreak(90); // Increased height for additional fields
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. SIGNATURES', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  y = addWrappedText('By signing below, the Parties acknowledge that they have read, understood, and agree to be bound by the terms and conditions of this Agreement.', margin, y, contentWidth, 4.5);
  y += 10;

  // Signature boxes - larger to accommodate extra client fields
  const sigBoxWidth = contentWidth / 2 - 5;
  const sigBoxHeight = 85; // Increased to accommodate company field

  // ===== LICENSOR (TNF) SIGNATURE BOX =====
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, sigBoxWidth, sigBoxHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FOR THE LICENSOR', margin + 5, y + 7);
  doc.line(margin + 5, y + 8, margin + sigBoxWidth - 5, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Name (prefilled)
  doc.setTextColor(102, 102, 102);
  doc.text('Name:', margin + 5, y + 18);
  doc.setTextColor(0, 0, 0);
  doc.text('Victor - The New Face', margin + 25, y + 18);

  // Signature field (text tag - white text to hide tag)
  doc.setTextColor(102, 102, 102);
  doc.text('Signature:', margin + 5, y + 38);
  doc.setTextColor(255, 255, 255); // White text for hidden tag
  doc.text('{{signature:1:y}}', margin + 28, y + 38);

  // Date field (text tag) - quadrupled font size: 10 -> 40
  doc.setTextColor(102, 102, 102);
  doc.text('Date:', margin + 5, y + 60);
  doc.setTextColor(255, 255, 255);
  doc.text('{{date:1:y::::60:40}}', margin + 20, y + 60);

  // ===== LICENSEE (CLIENT) SIGNATURE BOX =====
  const licSigX = margin + sigBoxWidth + 10;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(221, 221, 221);
  doc.rect(licSigX, y, sigBoxWidth, sigBoxHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FOR THE LICENSEE', licSigX + 5, y + 7);
  doc.line(licSigX + 5, y + 8, licSigX + sigBoxWidth - 5, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Company field (text tag - client fills in) - quadrupled font size: 8 -> 32
  doc.setTextColor(102, 102, 102);
  doc.text('Company:', licSigX + 5, y + 18);
  doc.setTextColor(255, 255, 255);
  doc.text('{{text:2:y:Company Name:::55:32}}', licSigX + 28, y + 18);

  // Name field (text tag - client fills in) - quadrupled font size: 8 -> 32
  doc.setTextColor(102, 102, 102);
  doc.text('Name:', licSigX + 5, y + 28);
  doc.setTextColor(255, 255, 255);
  doc.text('{{text:2:y:Full Name:::55:32}}', licSigX + 20, y + 28);

  // Role/Title field (text tag) - quadrupled font size: 8 -> 32
  doc.setTextColor(102, 102, 102);
  doc.text('Role:', licSigX + 5, y + 38);
  doc.setTextColor(255, 255, 255);
  doc.text('{{text:2:y:Role/Title:::55:32}}', licSigX + 20, y + 38);

  // Address field (text tag) - quadrupled font size: 8 -> 32
  doc.setTextColor(102, 102, 102);
  doc.text('Address:', licSigX + 5, y + 48);
  doc.setTextColor(255, 255, 255);
  doc.text('{{text:2:y:Address:::55:32}}', licSigX + 28, y + 48);

  // Signature field (text tag)
  doc.setTextColor(102, 102, 102);
  doc.text('Signature:', licSigX + 5, y + 62);
  doc.setTextColor(255, 255, 255);
  doc.text('{{signature:2:y}}', licSigX + 28, y + 62);

  // Date field (text tag) - quadrupled font size: 10 -> 40
  doc.setTextColor(102, 102, 102);
  doc.text('Date:', licSigX + 5, y + 78);
  doc.setTextColor(255, 255, 255);
  doc.text('{{date:2:y::::60:40}}', licSigX + 20, y + 78);

  y += sigBoxHeight + 15;

  // ========== FOOTER ==========
  checkPageBreak(20);
  doc.setDrawColor(221, 221, 221);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(102, 102, 102);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIAL', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated: ${new Date().toISOString().split('T')[0]} | The New Face - Video Production`, pageWidth / 2, y, { align: 'center' });

  // Return as ArrayBuffer then convert to Uint8Array
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const signwellApiKey = Deno.env.get('SIGNWELL_API_KEY');

    if (!signwellApiKey) {
      return new Response(
        JSON.stringify({ error: 'SignWell API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { agreementId, testMode = false } = await req.json();

    if (!agreementId) {
      return new Response(
        JSON.stringify({ error: 'Agreement ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending agreement ${agreementId} to SignWell (testMode: ${testMode})`);

    // Fetch agreement data
    const { data: agreement, error: agreementError } = await supabase
      .from('rights_agreements')
      .select(`
        *,
        projects:project_id (
          id,
          name,
          description
        )
      `)
      .eq('id', agreementId)
      .single();

    if (agreementError || !agreement) {
      console.error('Agreement fetch error:', agreementError);
      return new Response(
        JSON.stringify({ error: 'Agreement not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const project = agreement.projects as { id: string; name: string; description: string } | null;

    // Fetch usage selections
    const { data: selections, error: selectionsError } = await supabase
      .from('rights_usage_selections')
      .select('*')
      .eq('agreement_id', agreementId);

    if (selectionsError) {
      console.error('Selections fetch error:', selectionsError);
    }

    // Build template data
    const templateData: Record<string, string> = {
      CLIENT_NAME: agreement.client_name,
      CLIENT_CONTACT_NAME: agreement.client_contact_name || '',
      CLIENT_EMAIL: agreement.client_email,
      PROJECT_NAME: project?.name || 'N/A',
      CONTENT_DESCRIPTION: project?.description || 'Video content as per project documentation',
      DELIVERABLES: agreement.deliverables || 'As per Quotation',
      AGREEMENT_DATE: formatDate(agreement.agreement_date),
      VALID_FROM: formatDate(agreement.valid_from),
      VALID_UNTIL: agreement.valid_until ? formatDate(agreement.valid_until) : 'Perpetual',
      // Initialize all categories to No
      DIGITAL_GRANTED: 'No',
      PAID_MEDIA_GRANTED: 'No',
      POS_GRANTED: 'No',
      PRINT_GRANTED: 'No',
      OOH_GRANTED: 'No',
      TV_GRANTED: 'No',
    };

    // Populate granted rights from selections
    if (selections && selections.length > 0) {
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

    // Generate PDF document
    const pdfBytes = generateAgreementPdf(templateData);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const base64Content = btoa(binary);

    // Build recipients array - avoid duplicates if client email is same as TNF
    const recipients = [];
    
    // Always add TNF as first signer with signature and date fields
    recipients.push({
      id: 'tnf',
      name: 'The New Face',
      email: TNF_EMAIL,
      signing_order: 1,
    });

    // Only add client as second signer if different email (with date field required)
    const clientEmail = agreement.client_email?.toLowerCase().trim();
    if (clientEmail && clientEmail !== TNF_EMAIL.toLowerCase()) {
      recipients.push({
        id: 'client',
        name: agreement.client_contact_name || agreement.client_name,
        email: agreement.client_email,
        signing_order: 2,
      });
    }

    // Create document in SignWell with text tags for embedded signature fields
    const signwellPayload = {
      test_mode: testMode,
      text_tags: true, // Enable text tag parsing for embedded fields
      files: [
        {
          name: `the-new-face-usage-rights-agreement-${agreement.client_name.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          file_base64: base64Content,
        }
      ],
      name: `The New Face Usage Rights Agreement - ${agreement.client_name}`,
      subject: 'The New Face Usage Rights Agreement Ready for Signature',
      message: `Please review and sign the attached Usage Rights Agreement for the project "${project?.name || 'your project'}".\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe New Face`,
      recipients,
      draft: false,
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

    // Build success message
    const recipientEmails = recipients.map(r => r.email).join(' and ');

    return new Response(
      JSON.stringify({
        success: true,
        signwellDocumentId: signwellResult.id,
        message: `Agreement sent to ${recipientEmails} for signature`,
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
