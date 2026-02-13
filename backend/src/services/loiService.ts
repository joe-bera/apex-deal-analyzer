import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

interface Property {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_type: string;
  building_size?: number;
  lot_size?: number;
  year_built?: number;
  price?: number;
  apn?: string;
  additional_data?: any;
}

interface BuyerInfo {
  buyer_name: string;
  buyer_company?: string;
  buyer_address?: string;
  buyer_city?: string;
  buyer_state?: string;
  buyer_zip?: string;
  buyer_phone?: string;
  buyer_email?: string;
}

interface LOIParams {
  offer_price: number;
  earnest_money?: number;
  due_diligence_days?: number;
  closing_days?: number;
  contingencies?: string[];
  special_terms?: string;
}

export interface LOIResult {
  loi_html: string;
  loi_text: string;
  offer_price: number;
  earnest_money: number;
  due_diligence_days: number;
  closing_days: number;
  contingencies: string[];
  generated_at: string;
}

/**
 * Generate Letter of Intent using Claude AI
 */
export const generateLOI = async (
  property: Property,
  buyerInfo: BuyerInfo,
  params: LOIParams
): Promise<LOIResult> => {
  const earnest_money = params.earnest_money || Math.round(params.offer_price * 0.01); // 1% default
  const due_diligence_days = params.due_diligence_days || 30;
  const closing_days = params.closing_days || 45;
  const contingencies = params.contingencies || [
    'Buyer inspection and approval of property condition',
    'Buyer review and approval of all lease agreements (if applicable)',
    'Buyer review and approval of environmental reports',
    'Buyer obtaining financing (if applicable)',
    'Title review and approval',
  ];

  const prompt = `Generate a professional Letter of Intent (LOI) for the following commercial real estate transaction:

# PROPERTY DETAILS
Address: ${property.address || 'TBD'}
City: ${property.city || ''}, ${property.state || 'CA'} ${property.zip_code || ''}
Property Type: ${property.property_type}
Building Size: ${property.building_size ? `${property.building_size.toLocaleString()} SF` : 'TBD'}
Lot Size: ${property.lot_size ? (property.additional_data?.lot_size_unit === 'acres' ? `${(property.lot_size / 43560).toFixed(2)} acres` : `${property.lot_size.toLocaleString()} SF`) : 'TBD'}
Year Built: ${property.year_built || 'TBD'}
APN: ${property.apn || 'TBD'}

# BUYER INFORMATION
Buyer Name: ${buyerInfo.buyer_name}
Company: ${buyerInfo.buyer_company || 'N/A'}
Address: ${buyerInfo.buyer_address || ''}, ${buyerInfo.buyer_city || ''}, ${buyerInfo.buyer_state || ''} ${buyerInfo.buyer_zip || ''}
Phone: ${buyerInfo.buyer_phone || 'N/A'}
Email: ${buyerInfo.buyer_email || 'N/A'}

# OFFER TERMS
Purchase Price: $${params.offer_price.toLocaleString()}
Earnest Money Deposit: $${earnest_money.toLocaleString()}
Due Diligence Period: ${due_diligence_days} days
Closing Timeline: ${closing_days} days from execution of Purchase Agreement

# CONTINGENCIES
${contingencies.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${params.special_terms ? `# SPECIAL TERMS\n${params.special_terms}` : ''}

Generate a professional, legally-styled Letter of Intent that includes:
1. A proper header with date and recipient placeholder
2. Introduction stating intent to purchase
3. Property description
4. Purchase price and payment terms
5. Earnest money deposit terms
6. Due diligence period and rights
7. Closing timeline
8. Contingencies
9. Exclusivity period request (if applicable)
10. Non-binding nature disclaimer
11. Expiration date (7 days from date)
12. Signature blocks for both parties

Format the response as JSON with two fields:
{
  "loi_html": "<complete HTML formatted LOI with proper styling for PDF generation>",
  "loi_text": "<plain text version of the LOI>"
}

Make the LOI professional, clear, and suitable for submission to a commercial property seller. Include appropriate legal disclaimers about the non-binding nature of the LOI.`;

  try {
    const message = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = message.content[0];
    if (response.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    // Parse response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      loi_html: parsed.loi_html || '',
      loi_text: parsed.loi_text || '',
      offer_price: params.offer_price,
      earnest_money,
      due_diligence_days,
      closing_days,
      contingencies,
      generated_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('LOI generation error:', error);
    throw new Error(`Failed to generate LOI: ${error.message}`);
  }
};

/**
 * Generate a simple LOI template without AI (faster, cheaper)
 */
export const generateLOITemplate = (
  property: Property,
  buyerInfo: BuyerInfo,
  params: LOIParams
): LOIResult => {
  const earnest_money = params.earnest_money || Math.round(params.offer_price * 0.01);
  const due_diligence_days = params.due_diligence_days || 30;
  const closing_days = params.closing_days || 45;
  const contingencies = params.contingencies || [
    'Buyer inspection and approval of property condition',
    'Buyer review and approval of all lease agreements (if applicable)',
    'Buyer review and approval of environmental reports',
    'Title review and approval',
  ];

  const today = new Date();
  const expirationDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const propertyAddress = `${property.address || '[Property Address]'}, ${property.city || '[City]'}, ${property.state || 'CA'} ${property.zip_code || ''}`;

  const loi_text = `
LETTER OF INTENT

Date: ${formatDate(today)}

To: [Seller Name]
    [Seller Address]
    [City, State ZIP]

Re: Letter of Intent to Purchase
    Property: ${propertyAddress}

Dear Sir/Madam:

${buyerInfo.buyer_name}${buyerInfo.buyer_company ? ` ("${buyerInfo.buyer_company}")` : ''} ("Buyer") is pleased to submit this non-binding Letter of Intent ("LOI") to purchase the property located at ${propertyAddress} ("Property") under the following terms and conditions:

1. PURCHASE PRICE
   The purchase price for the Property shall be ${params.offer_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (the "Purchase Price"), payable in cash at closing.

2. EARNEST MONEY DEPOSIT
   Upon execution of a mutually acceptable Purchase and Sale Agreement, Buyer shall deposit ${earnest_money.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} as earnest money with an escrow agent mutually agreed upon by the parties. The earnest money shall be applied to the Purchase Price at closing or refunded to Buyer if the transaction does not close due to a failed contingency.

3. DUE DILIGENCE PERIOD
   Buyer shall have ${due_diligence_days} days from the execution of the Purchase and Sale Agreement to conduct its due diligence inspection of the Property. During this period, Buyer may terminate the agreement for any reason and receive a full refund of the earnest money deposit.

4. CLOSING
   Closing shall occur within ${closing_days} days after the expiration of the due diligence period, or such other date as mutually agreed upon by the parties.

5. CONTINGENCIES
   This offer is contingent upon the following:
${contingencies.map((c, i) => `   ${String.fromCharCode(97 + i)}) ${c}`).join('\n')}

6. PROPERTY CONDITION
   The Property shall be conveyed in its "as-is" condition as of the date of closing, subject to Buyer's satisfactory completion of due diligence.

7. TITLE
   Seller shall convey marketable and insurable fee simple title to the Property, free and clear of all liens, encumbrances, and exceptions other than those acceptable to Buyer.

8. CLOSING COSTS
   Each party shall pay its own closing costs customary to such party in the jurisdiction where the Property is located.

9. CONFIDENTIALITY
   Both parties agree to keep the terms of this LOI and any subsequent negotiations confidential.

10. NON-BINDING NATURE
    This LOI is intended to be non-binding and is for discussion purposes only. Neither party shall have any legal obligation to the other unless and until a definitive Purchase and Sale Agreement is executed by both parties.

11. EXPIRATION
    This LOI shall expire if not accepted by ${formatDate(expirationDate)}.

${params.special_terms ? `12. SPECIAL TERMS\n    ${params.special_terms}\n\n` : ''}
We look forward to your favorable response and to working together to complete this transaction.

Sincerely,

_______________________________
${buyerInfo.buyer_name}
${buyerInfo.buyer_company || ''}
${buyerInfo.buyer_address ? `${buyerInfo.buyer_address}` : ''}
${buyerInfo.buyer_city ? `${buyerInfo.buyer_city}, ${buyerInfo.buyer_state || ''} ${buyerInfo.buyer_zip || ''}` : ''}
${buyerInfo.buyer_phone ? `Phone: ${buyerInfo.buyer_phone}` : ''}
${buyerInfo.buyer_email ? `Email: ${buyerInfo.buyer_email}` : ''}


ACKNOWLEDGED AND AGREED:

_______________________________
Seller Name: _______________________________
Date: _______________________________
`.trim();

  const loi_html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; max-width: 8.5in; margin: 0 auto; padding: 1in; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 24pt; text-decoration: underline; }
    .header { margin-bottom: 24pt; }
    .date { margin-bottom: 12pt; }
    .recipient { margin-bottom: 24pt; }
    .re { margin-bottom: 24pt; font-weight: bold; }
    .section { margin-bottom: 12pt; }
    .section-title { font-weight: bold; }
    .signature-block { margin-top: 36pt; }
    .signature-line { border-bottom: 1px solid #000; width: 250px; margin: 24pt 0 6pt 0; }
  </style>
</head>
<body>
  <h1>LETTER OF INTENT</h1>

  <div class="header">
    <div class="date">Date: ${formatDate(today)}</div>
    <div class="recipient">
      To: [Seller Name]<br>
      [Seller Address]<br>
      [City, State ZIP]
    </div>
    <div class="re">
      Re: Letter of Intent to Purchase<br>
      Property: ${propertyAddress}
    </div>
  </div>

  <p>Dear Sir/Madam:</p>

  <p>${buyerInfo.buyer_name}${buyerInfo.buyer_company ? ` ("${buyerInfo.buyer_company}")` : ''} ("Buyer") is pleased to submit this non-binding Letter of Intent ("LOI") to purchase the property located at ${propertyAddress} ("Property") under the following terms and conditions:</p>

  <div class="section">
    <span class="section-title">1. PURCHASE PRICE</span><br>
    The purchase price for the Property shall be ${params.offer_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (the "Purchase Price"), payable in cash at closing.
  </div>

  <div class="section">
    <span class="section-title">2. EARNEST MONEY DEPOSIT</span><br>
    Upon execution of a mutually acceptable Purchase and Sale Agreement, Buyer shall deposit ${earnest_money.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} as earnest money with an escrow agent mutually agreed upon by the parties.
  </div>

  <div class="section">
    <span class="section-title">3. DUE DILIGENCE PERIOD</span><br>
    Buyer shall have ${due_diligence_days} days from the execution of the Purchase and Sale Agreement to conduct its due diligence inspection of the Property.
  </div>

  <div class="section">
    <span class="section-title">4. CLOSING</span><br>
    Closing shall occur within ${closing_days} days after the expiration of the due diligence period.
  </div>

  <div class="section">
    <span class="section-title">5. CONTINGENCIES</span><br>
    ${contingencies.map((c, i) => `${String.fromCharCode(97 + i)}) ${c}<br>`).join('')}
  </div>

  <div class="section">
    <span class="section-title">6. NON-BINDING NATURE</span><br>
    This LOI is intended to be non-binding and is for discussion purposes only.
  </div>

  <div class="section">
    <span class="section-title">7. EXPIRATION</span><br>
    This LOI shall expire if not accepted by ${formatDate(expirationDate)}.
  </div>

  ${params.special_terms ? `<div class="section"><span class="section-title">8. SPECIAL TERMS</span><br>${params.special_terms}</div>` : ''}

  <p>We look forward to your favorable response.</p>

  <div class="signature-block">
    <p>Sincerely,</p>
    <div class="signature-line"></div>
    <p>
      ${buyerInfo.buyer_name}<br>
      ${buyerInfo.buyer_company || ''}<br>
      ${buyerInfo.buyer_email || ''}
    </p>
  </div>

  <div class="signature-block">
    <p>ACKNOWLEDGED AND AGREED:</p>
    <div class="signature-line"></div>
    <p>
      Seller Name: ___________________<br>
      Date: ___________________
    </p>
  </div>
</body>
</html>
`.trim();

  return {
    loi_html,
    loi_text,
    offer_price: params.offer_price,
    earnest_money,
    due_diligence_days,
    closing_days,
    contingencies,
    generated_at: new Date().toISOString(),
  };
};
