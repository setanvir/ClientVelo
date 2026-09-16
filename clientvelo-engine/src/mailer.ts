import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from './config.js';

let transporterInstance: Transporter | null = null;

export function getTransporter(): Transporter {
  if (transporterInstance) {
    return transporterInstance;
  }

  transporterInstance = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE, // true for 465, false for other ports
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_APP_PASSWORD,
    },
  });

  return transporterInstance;
}

export interface SendMailResult {
  messageId?: string;
  response?: string;
  error?: Error;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  dryRun: boolean = true
): Promise<SendMailResult> {
  const mailOptions = {
    from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
    replyTo: config.REPLY_TO || config.FROM_EMAIL,
    to,
    subject,
    text,
  };

  if (dryRun) {
    console.log(`[mailer] DRY RUN: Would send email to ${to} (Subject: ${subject})`);
    return {
      messageId: `dry-run-${Date.now()}`,
      response: '250 DRY RUN OK',
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return {
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error: any) {
    return {
      error,
    };
  }
}
