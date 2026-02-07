import { Resend } from 'resend';
import { config } from '../config/env';
import { supabaseAdmin as supabase } from '../config/supabase';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!config.resend.apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(config.resend.apiKey);
  }
  return resend;
}

interface BrokerInfo {
  full_name?: string;
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  company_logo_url?: string;
}

interface BuildEmailParams {
  bodyHtml: string;
  brokerInfo: BrokerInfo;
  unsubscribeUrl: string;
  recipientName?: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if an email is on the unsubscribe list (case-insensitive)
 */
export const isUnsubscribed = async (email: string): Promise<boolean> => {
  const { data } = await supabase
    .from('email_unsubscribes')
    .select('id')
    .ilike('email', email)
    .limit(1);

  return (data && data.length > 0) || false;
};

/**
 * Filter out unsubscribed emails from a list of recipients.
 * Returns only eligible recipients.
 */
export const filterUnsubscribed = async (
  recipients: Array<{ email: string; [key: string]: any }>
): Promise<Array<{ email: string; [key: string]: any }>> => {
  if (recipients.length === 0) return [];

  const emails = recipients.map((r) => r.email.toLowerCase());

  const { data: unsubs } = await supabase
    .from('email_unsubscribes')
    .select('email')
    .in('email', emails);

  const unsubSet = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()));

  return recipients.filter((r) => !unsubSet.has(r.email.toLowerCase()));
};

/**
 * Wrap AI-generated body HTML in a branded email template
 */
export const buildEmailHtml = ({
  bodyHtml,
  brokerInfo,
  unsubscribeUrl,
  recipientName,
}: BuildEmailParams): string => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';

  const brokerBlock = [
    brokerInfo.full_name,
    brokerInfo.company_name,
    brokerInfo.company_phone,
    brokerInfo.company_email,
  ]
    .filter(Boolean)
    .map((line) => `<span>${line}</span>`)
    .join('<br/>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1e40af; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; color: #333333; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px 0; }
    .body ul { margin: 0 0 16px 0; padding-left: 20px; }
    .body li { margin-bottom: 8px; }
    .footer { padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    .broker-info { margin-bottom: 16px; line-height: 1.6; }
    .unsubscribe { font-size: 12px; color: #9ca3af; }
    .unsubscribe a { color: #9ca3af; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${brokerInfo.company_name || 'Apex Real Estate Services'}</h1>
    </div>
    <div class="body">
      <p>${greeting}</p>
      ${bodyHtml}
    </div>
    <div class="footer">
      <div class="broker-info">
        ${brokerBlock}
      </div>
      <div class="unsubscribe">
        <a href="${unsubscribeUrl}">Unsubscribe</a> from future emails.
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send a single email via Resend
 */
export const sendEmail = async (params: SendEmailParams): Promise<SendResult> => {
  try {
    if (!config.resend.apiKey) {
      return { success: false, error: 'RESEND_API_KEY is not configured' };
    }

    const { data, error } = await getResend().emails.send({
      from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[EmailService] Send failed:', err);
    return { success: false, error: err.message || 'Unknown send error' };
  }
};
