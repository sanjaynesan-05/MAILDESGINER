import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER || '';
const password = process.env.GMAIL_APP_PASSWORD || '';

export const isConfigured = Boolean(user && password);
export const gmailUser = user;

const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: password } });

export async function sendMail(options: { to: string; cc?: string; bcc?: string; subject: string; html: string; attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string }[] }) {
  if (!isConfigured) throw new Error('Gmail is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.');
  return transporter.sendMail({ from: user, to: options.to, cc: options.cc, bcc: options.bcc, subject: options.subject, html: options.html, attachments: options.attachments });
}
