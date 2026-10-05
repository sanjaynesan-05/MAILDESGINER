import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { generateEmailHtml } from '../services/html.service.ts';
import { gmailUser, isConfigured, sendMail } from '../services/mail.service.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 10, fileSize: 10 * 1024 * 1024 } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logoBuffer = readFileSync(fileURLToPath(new URL('../../src/assets/JSN DESIGN.png', import.meta.url)));
const list = (value: unknown) => typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];

router.get('/config', (_request, response) => response.json({ connected: isConfigured, gmailUser: isConfigured ? gmailUser : null }));

const handleSend = (test: boolean) => [upload.array('attachments', 10), async (request: any, response: any) => {
  try {
    const payload = JSON.parse(request.body.payload || '{}');
    const recipients = list(payload.to);
    if (!recipients.length || !recipients.every((email) => emailPattern.test(email))) return response.status(400).json({ error: 'Enter at least one valid recipient.' });
    if (typeof payload.subject !== 'string' || !payload.subject.trim() || payload.subject.length > 200) return response.status(400).json({ error: 'A subject between 1 and 200 characters is required.' });
    if (test && !isConfigured) return response.status(503).json({ error: 'Gmail is not configured for test sending.' });
    const files: { filename: string; content: Buffer; contentType: string; cid?: string }[] = (request.files || []).map((file: any) => ({ filename: file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'), content: file.buffer, contentType: file.mimetype }));
    // Logo embedded inline via CID reference — must include cid property for nodemailer to embed
    files.push({ filename: 'JSN-DESIGN.png', content: logoBuffer, contentType: 'image/png', cid: 'jsn-logo' });
    await sendMail({ to: recipients.join(', '), cc: list(payload.cc).join(', ') || undefined, bcc: list(payload.bcc).join(', ') || undefined, subject: payload.subject.trim(), html: generateEmailHtml(payload, 'cid:jsn-logo'), attachments: files });
    return response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send email';
    return response.status(message.startsWith('Gmail is not') ? 503 : 400).json({ error: message });
  }
}];

router.post('/test', ...handleSend(true) as any);
router.post('/send', ...handleSend(false) as any);
export default router;
